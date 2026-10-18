import {
  ApiError,
  connection,
  readJson,
  type SanityEnv,
} from "./sanity";
const MAX = 10 * 1024 * 1024;
function signature(bytes: Uint8Array, type: string) {
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return (
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  );
}
export async function uploadImage(
  request: Request,
  env: SanityEnv,
  transport?: (path: "fixed-length" | "counted") => void,
) {
  const target = connection(env, true, true);
  const type = request.headers.get("Content-Type") ?? "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(type))
    throw new ApiError(415, "יש לבחור תמונת JPG, PNG או WebP");
  const length = request.headers.get("Content-Length");
  // Only bounded, native fixed-length uploads have passed the remote Free gate.
  // Keep the larger/chunked fixture path available exclusively for local tests.
  const production = env.SANITY_MODE === "production";
  const limit = production ? 2 * 1024 * 1024 : MAX;
  if (production && length === null)
    throw new ApiError(411, "לא ניתן לזהות את גודל התמונה. בחרי קובץ מהמכשיר ונסי שוב.");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new ApiError(413, production ? "התמונה גדולה מ־2MB" : "התמונה גדולה מ־10MB");
  const declared = length === null ? null : Number(length);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "תמונה חסרה");
  const abort = new AbortController();
  let failure: ApiError | undefined,
    finished = false,
    total = 0,
    prefixLength = 0;
  const prefix = new Uint8Array(12);
  const initial: Uint8Array[] = [];
  const cancel = () => {
    abort.abort();
    void reader.cancel().catch(() => {});
  };
  const disconnected = () => {
    failure = new ApiError(499, "ההעלאה בוטלה");
    cancel();
  };
  request.signal.addEventListener("abort", disconnected, { once: true });
  const timeout = setTimeout(() => {
    failure = new ApiError(504, "ההעלאה ארכה זמן רב מדי. נסי שוב.");
    cancel();
  }, 60000);
  try {
    if (request.signal.aborted) disconnected();
    if (failure) throw failure;
    // Only a 12-byte signature is copied. Native stream chunks are forwarded
    // without concatenating the image or reading beyond downstream backpressure.
    while (prefixLength < 12) {
      const part = await reader.read();
      if (part.done) {
        finished = true;
        break;
      }
      total += part.value.length;
      if (total > MAX) throw new ApiError(413, "התמונה גדולה מ־10MB");
      initial.push(part.value);
      const take = Math.min(12 - prefixLength, part.value.length);
      prefix.set(part.value.subarray(0, take), prefixLength);
      prefixLength += take;
    }
    if (!signature(prefix, type)) throw new ApiError(415, "קובץ תמונה לא תקין");
    let stream: ReadableStream<Uint8Array>;
    if (declared !== null) {
      if (total > declared) throw new ApiError(400, "הקובץ לא הועלה במלואו");
      // Native workerd byte accounting enforces the exact declared size (already
      // capped at MAX), without a JavaScript read/enqueue callback per chunk.
      // Do not set Content-Length manually: FixedLengthStream supplies it.
      const fixed = new FixedLengthStream(declared);
      transport?.("fixed-length");
      stream = fixed.readable;
      reader.releaseLock();
      finished = false;
      void (async () => {
        const writer = fixed.writable.getWriter();
        try {
          for (const chunk of initial) await writer.write(chunk);
        } finally {
          writer.releaseLock();
        }
        initial.length = 0;
        await request.body!.pipeTo(fixed.writable, { signal: abort.signal });
        total = declared;
        finished = true;
      })().catch(() => {
        failure ??= new ApiError(400, "הקובץ לא הועלה במלואו");
        cancel();
      });
    } else {
      // Unknown-length requests retain running MAX enforcement and pull-driven
      // backpressure; no declared length is trusted to bypass this counter.
      let initialIndex = 0;
      transport?.("counted");
      stream = new ReadableStream<Uint8Array>(
        {
          async pull(controller) {
            try {
              if (initialIndex < initial.length) {
                controller.enqueue(initial[initialIndex++]!);
                return;
              }
              if (finished) {
                controller.close();
                return;
              }
              const part = await reader.read();
              if (part.done) {
                finished = true;
                controller.close();
                return;
              }
              total += part.value.length;
              if (total > MAX) {
                failure = new ApiError(413, "התמונה גדולה מ־10MB");
                controller.error(failure);
                cancel();
                return;
              }
              controller.enqueue(part.value);
            } catch (error) {
              failure ??= new ApiError(499, "ההעלאה הופסקה. נסי שוב.");
              controller.error(error);
              cancel();
            }
          },
          cancel() {
            failure ??= new ApiError(499, "ההעלאה בוטלה");
            cancel();
          },
        },
        { highWaterMark: 0 },
      );
    }
    const response = await fetch(
      target.origin + target.apiVersion + "/assets/images/" + target.dataset,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + target.token,
          "Content-Type": type,
        },
        body: stream,
        signal: abort.signal,
      },
    );
    if (failure) throw failure;
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new ApiError(502, "העלאת התמונה נכשלה. נסי שוב.");
    }
    if (!finished) throw new ApiError(502, "שרת התמונות לא אישר העלאה מלאה");
    if (length !== null && total !== Number(length))
      throw new ApiError(400, "הקובץ לא הועלה במלואו");
    const payload = (await readJson(response, 65536)) as {
      document?: {
        _id?: string;
        _type?: string;
        url?: string;
        size?: number;
        mimeType?: string;
        metadata?: { dimensions?: { width?: number; height?: number } };
      };
    };
    const asset = payload.document;
    const dimensions = asset?.metadata?.dimensions;
    const prefixUrl = target.assetPrefix;
    if (
      !asset ||
      asset._type !== "sanity.imageAsset" ||
      !/^image-[a-f0-9]{40}-\d+x\d+-(png|jpg|webp)$/.test(asset._id ?? "") ||
      asset.url !==
        prefixUrl +
          (asset._id ?? "")
            .replace(/^image-/, "")
            .replace(/-(png|jpg|webp)$/, ".$1") ||
      asset.size !== total ||
      asset.mimeType !== type ||
      !dimensions ||
      !Number.isSafeInteger(dimensions.width) ||
      !Number.isSafeInteger(dimensions.height) ||
      dimensions.width! <= 0 ||
      dimensions.height! <= 0 ||
      dimensions.width! * dimensions.height! > 40_000_000
    )
      throw new ApiError(502, "שרת התמונות החזיר פרטים לא תקינים");
    return {
      id: crypto.randomUUID(),
      assetId: asset._id!,
      src: asset.url!,
      alt: "",
      bytes: total,
    };
  } catch (error) {
    throw (
      failure ??
      (error instanceof ApiError
        ? error
        : new ApiError(502, "העלאת התמונה נכשלה. נסי שוב."))
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", disconnected);
    if (!finished) cancel();
    // The pump has a rejection handler. Do not await a canceled source here:
    // an interrupted client may never deliver another chunk or EOF.
    try {
      reader.releaseLock();
    } catch {
      /* cancellation may still settle a pending read */
    }
  }
}

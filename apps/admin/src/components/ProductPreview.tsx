"use client";
import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog } from "./Dialog";
import { price, colors, type AdminProduct } from "@/lib/model";

export function ProductPreview({
  product,
  onClose,
}: {
  product: AdminProduct;
  onClose: () => void;
}) {
  const [view, setView] = useState("page");
  const [image, setImage] = useState(0);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const activeImage = product.images[image];
  return (
    <Dialog title="תצוגה מקדימה" onClose={onClose} wide>
      <div className="preview-toolbar">
        <div className="segmented">
          <button
            className={view === "card" ? "selected" : ""}
            aria-pressed={view === "card"}
            onClick={() => setView("card")}
          >
            כרטיס בקטלוג
          </button>
          <button
            className={view === "page" ? "selected" : ""}
            aria-pressed={view === "page"}
            onClick={() => setView("page")}
          >
            עמוד מוצר מלא
          </button>
        </div>
        <p>תצוגה בלבד · המוצר לא מתפרסם</p>
      </div>
      <section className="store-preview">
        <div className="preview-brand wordmark" dir="ltr">
          ATELIER
        </div>
        {view === "card" ? (
          <article className="preview-card">
            {activeImage ? (
              <img src={product.images[0].src} alt={product.images[0].alt || product.name} />
            ) : (
              <div className="preview-no-image">התמונה שלך תופיע כאן</div>
            )}
            <h3>{product.name || "שם המוצר"}</h3>
            <p>{price(product.priceAgorot)}</p>
          </article>
        ) : (
          <div className="preview-product">
            <div className="preview-gallery">
              <div className="preview-main-image">
                {activeImage ? (
                  <img src={activeImage.src} alt={activeImage.alt || product.name} />
                ) : (
                  <div className="preview-no-image">התמונה שלך תופיע כאן</div>
                )}
                {product.images.length > 1 && (
                  <>
                    <button
                      className="gallery-next"
                      aria-label="התמונה הבאה"
                      onClick={() => setImage((image + 1) % product.images.length)}
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      className="gallery-prev"
                      aria-label="התמונה הקודמת"
                      onClick={() =>
                        setImage((image - 1 + product.images.length) % product.images.length)
                      }
                    >
                      <ChevronRight />
                    </button>
                  </>
                )}
              </div>
              <div className="gallery-dots">
                {product.images.map((photo, i) => (
                  <button
                    key={photo.id}
                    aria-label={`הצגת תמונה ${i + 1}`}
                    aria-pressed={image === i}
                    className={i === image ? "active" : ""}
                    onClick={() => setImage(i)}
                  />
                ))}
              </div>
            </div>
            <div className="preview-details">
              <h3>{product.name || "שם המוצר"}</h3>
              <p className="preview-price">{price(product.priceAgorot)}</p>
              {product.description && <p className="preview-description">{product.description}</p>}
              {product.colors.length > 0 && (
                <div className="preview-options">
                  <p>
                    צבע: <strong>{color}</strong>
                  </p>
                  <div className="swatches">
                    {product.colors.map((name) => (
                      <button
                        key={name}
                        className={`swatch ${color === name ? "chosen" : ""}`}
                        style={{
                          background: colors.find((c) => c.name === name)?.hex ?? "#b9a99a",
                        }}
                        aria-label={name}
                        aria-pressed={color === name}
                        onClick={() => setColor(name)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {product.sizes.length > 0 && (
                <div className="preview-options">
                  <p>
                    מידה: <strong>{size}</strong>
                  </p>
                  <div className="size-options" dir="ltr">
                    {product.sizes.map((value) => (
                      <button
                        key={value}
                        className={size === value ? "chosen" : ""}
                        aria-pressed={size === value}
                        onClick={() => setSize(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="preview-contact">
                לפרטים בוואטסאפ<span>תצוגה לדוגמה בלבד</span>
              </div>
              <details>
                <summary>פרטים מלאים</summary>
                <p>{product.description || "פרטי המוצר יוצגו כאן."}</p>
              </details>
            </div>
          </div>
        )}
      </section>
      <div className="preview-return">
        <button className="button" onClick={onClose}>
          <ArrowRight size={16} />
          חזרה לעריכה
        </button>
      </div>
    </Dialog>
  );
}

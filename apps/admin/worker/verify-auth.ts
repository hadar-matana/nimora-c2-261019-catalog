// Local-only separate isolate for measuring outer Worker activity without bcrypt.
// This is test instrumentation, not a second production Worker proposal.
export { OwnerAuth } from "./index";
const verificationWorker = {
  fetch() {
    return new Response("Verification fixture only", { status: 404 });
  },
};

export default verificationWorker;

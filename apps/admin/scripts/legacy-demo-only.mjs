// Historical operational tools target the ATELIER demo, not a client deployment.
// They are deliberately outside the Phase A local-development workflow.
if (process.env.ATELIER_LEGACY_DEMO_OPERATIONS !== 'approved') {
  throw new Error('Historical demo operations are disabled. Never use these tools for client deployments. A separately authorized demo operation requires ATELIER_LEGACY_DEMO_OPERATIONS=approved.');
}

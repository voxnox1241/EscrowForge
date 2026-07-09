export function isUserRejection(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /reject|declin|denied|cancel/i.test(message);
}

/** Map raw contract/RPC errors to human-readable failure text. */
export function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/require_auth|InvalidAction|Auth/i.test(message)) {
    return "Not authorized — only the deal's creator can perform this action.";
  }
  if (/underfunded|insufficient/i.test(message)) {
    return "Insufficient balance to complete this transaction.";
  }
  if (/deal not found/i.test(message)) {
    return "This deal ID does not exist on the contract.";
  }
  if (/milestone is not locked|secured/i.test(message)) {
    return "That stage was already disbursed or returned.";
  }
  if (/nothing to refund/i.test(message)) {
    return "Every stage is already settled — nothing left to return.";
  }
  return message;
}

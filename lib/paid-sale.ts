/** Payment evidence is separate from an auction result or an invoice's status. */
export function verifiedPaidSale(sale: any): boolean {
  return Boolean(sale && sale.buyerPaymentStatus === 'Paid'
    && sale.paymentVerifiedAt instanceof Date && Number.isFinite(sale.paymentVerifiedAt.getTime())
    && typeof sale.paymentReference === 'string' && sale.paymentReference.trim()
    && Number.isFinite(Number(sale.saleAmount)) && Number(sale.saleAmount) > 0);
}

export function validateSaleInput(body: any): string | null {
  if (!Number.isInteger(Number(body.boat_id)) || Number(body.boat_id) <= 0) return 'A valid boat is required';
  if (!Number.isFinite(Number(body.sale_amount)) || Number(body.sale_amount) <= 0) return 'Sale amount must be greater than zero';
  if (body.sale_date && !Number.isFinite(new Date(body.sale_date).getTime())) return 'Invalid sale date';
  if (body.buyer_payment_status === 'Paid') {
    if (typeof body.payment_reference !== 'string' || !body.payment_reference.trim()) return 'A payment receipt/reference is required to confirm full payment';
    const paid = new Date(body.payment_verified_at || '');
    if (!Number.isFinite(paid.getTime()) || paid.getTime() > Date.now()) return 'A valid cleared-payment date is required';
  }
  return null;
}

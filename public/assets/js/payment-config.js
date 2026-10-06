// Public payment configuration. Keep Stripe credentials in Supabase Secrets.
window.RENOBVA_PAYMENTS = {
  checkout: { dynamic: true },
  bank: {
    enabled: true,
    accountName: "RENOBVA",
    iban: "DE14 1001 0010 0000 0000 00",
    bic: "REVODEB2",
    bankName: "Revoult Bank UAB, Zweigniederlassung Deutschland FORA Linden Palais, Unter den Linden 40, 10117 Berlin, Germany"
  }
};

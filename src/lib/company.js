export const company = {
  name: 'ED-IA Solutions',
  address: 'Via Esempio 1, 6900 Lugano (CH)',
  vat: 'CHE-000.000.000',
  email: 'info@ed-ia.ch',
  phone: '+41 00 000 00 00',
};

export const publicUrl = (path) => new URL(path, import.meta.env.BASE_URL).toString();

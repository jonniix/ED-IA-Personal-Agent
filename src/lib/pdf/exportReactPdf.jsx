// ...existing imports...
import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer';
// ...existing imports...

const styles = StyleSheet.create({
  h1: { fontSize: 14, marginBottom: 6 },
  h2: { fontSize: 12, marginTop: 8, marginBottom: 4 },
  p: { fontSize: 10, lineHeight: 1.4 },
  li: { fontSize: 10, marginLeft: 10 },
  section: { marginBottom: 8 }
});

export default function OfferPdf({ offer /* ...other props... */ }) {
  // ...existing code to extract customer, proposal, summary, analysis...

  return (
    <Document>
      <Page size="A4" style={{ padding: 24 }}>
        {/* 1) Dati + Dettagli proposta */}
        <View style={styles.section}>
          <Text style={styles.h1}>Dati cliente</Text>
          {/* ...render customer data... */}
        </View>
        <View style={styles.section}>
          <Text style={styles.h1}>Dettagli proposta</Text>
          {/* ...render proposal details... */}
        </View>
        {/* 2) Riassunto */}
        <View style={styles.section}>
          <Text style={styles.h1}>Riassunto</Text>
          {/* ...render summary... */}
        </View>
        {/* Forza la pagina 2 da qui in avanti */}
        <View break />
        {/* 3) Analisi economica in dettaglio */}
        <View style={styles.section}>
          <Text style={styles.h1}>Analisi economica (dettaglio)</Text>
          {/* ...render analysis... */}
        </View>
        {/* 4) Condizioni di pagamento e accettazione */}
        <View style={styles.section}>
          <Text style={styles.h1}>Condizioni di pagamento e accettazione</Text>
          <Text style={styles.p}>
            Il pagamento è suddiviso come segue:
          </Text>
          <View style={{ marginTop: 4 }}>
            <Text style={styles.li}>• 40% all’ordine materiale</Text>
            <Text style={styles.li}>• 40% alla posa impianto FV</Text>
            <Text style={styles.li}>• 20% allacciamento e collaudi (incluso dossier finale completo di ogni documento)</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

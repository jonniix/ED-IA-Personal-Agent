export default function Signatures() {
  return (
    <section style={{ marginTop: 24 }}>
      <h3>Firme</h3>
      <div style={{ display: 'flex', gap: 48, marginTop: 32, justifyContent: 'space-between' }}>
        <div style={{ width: 260 }}>
          <div style={{ borderTop: '1px solid #000', height: 0 }} />
          <small>Firma venditore</small>
        </div>
        <div style={{ width: 260 }}>
          <div style={{ borderTop: '1px solid #000', height: 0 }} />
          <small>Firma cliente</small>
        </div>
      </div>
    </section>
  );
}

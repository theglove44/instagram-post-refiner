/**
 * Shared building blocks for Pulse's "The Wall" design (design-samples/05-wall.html).
 */

export const pct0 = (n) => (n == null ? '—' : Math.round(n * 100) + '%');
export const int = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-GB'));
export const f1 = (n) => (n == null ? '—' : n.toFixed(1));

export const fontFraunces = { fontFamily: "'Fraunces', Georgia, serif" };
export const fontCaveat = { fontFamily: "'Caveat', cursive" };

export const sectionHead = {
  display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap',
};
export const menuTitle = { ...fontFraunces, fontWeight: 500, fontSize: 19, color: '#F2EDE0' };
export const menuTag = { fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8FA098' };

export function Leader({ name, value, small, hot, faded }) {
  return (
    <div className="pulse-leader">
      <span style={{ fontSize: 14.5, whiteSpace: 'nowrap', color: '#F2EDE0' }}>{name}</span>
      <span style={{ flex: 1, borderBottom: '2px dotted rgba(242,237,224,0.35)', transform: 'translateY(-4px)' }} />
      <span style={{ ...fontFraunces, fontWeight: 700, fontSize: 19, whiteSpace: 'nowrap', color: hot ? '#E39A8B' : faded ? '#8FA098' : '#F2EDE0' }}>
        {value}{small && <span style={{ fontSize: 12, color: '#8FA098', fontWeight: 400 }}> {small}</span>}
      </span>
    </div>
  );
}

export function Note({ tag, children }) {
  return (
    <div style={{ marginTop: 16, border: '1px dashed rgba(233,196,106,0.5)', borderRadius: 4, padding: '14px 14px 12px', position: 'relative' }}>
      <span style={{ ...fontCaveat, position: 'absolute', top: -13, left: 12, background: '#1C2B26', padding: '0 8px', fontSize: 17, color: '#E9C46A', transform: 'rotate(-1.5deg)' }}>{tag}</span>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: '#F2EDE0', margin: 0 }}>{children}</p>
    </div>
  );
}

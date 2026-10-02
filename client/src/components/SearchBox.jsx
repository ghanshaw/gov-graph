export default function SearchBox({ value, onChange, placeholder, autoFocus = false }) {
  return (
    <label className="search">
      <span aria-hidden="true">⌕</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

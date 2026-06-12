export default function SearchBar ({
    value,
    onChange,
    onSubmit,
    onFocusChange,
    isFocused,
}) {
    return (
        <input
            className="searchbar"
            type="search"
            name="search"
            id="search"
            value={value}
            placeholder={isFocused ? '' : 'Какой фильм хотите найти?'}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmit?.()
            }}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => onFocusChange?.(false)}
        />
    )
}

function getLabel(m) {
    if (!m) return 'Unknown';
    return m.label || m.Label || m.category || m.Category || m.CategoryLabel || 'Unknown';
}

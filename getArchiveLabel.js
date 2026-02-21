function getArchiveLabel(m) {
    if (!m) return 'Unknown';
    return m.category || m.Category || m.CategoryLabel || m.label || m.Label || 'Unknown';
}

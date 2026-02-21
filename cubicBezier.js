function cubicBezier(x1, y1, x2, y2) {
    const cx = 3.0 * x1;
    const bx = 3.0 * (x2 - x1) - cx;
    const ax = 1.0 - cx - bx;

    const cy = 3.0 * y1;
    const by = 3.0 * (y2 - y1) - cy;
    const ay = 1.0 - cy - by;

    function sampleX(t) { return ((ax * t + bx) * t + cx) * t; }
    function sampleY(t) { return ((ay * t + by) * t + cy) * t; }

    return function(t) {
        let lo = 0.0, hi = 1.0, u = t;
        for (let i = 0; i < 20; i++) {
            const x = sampleX(u);
            if (Math.abs(x - t) < 1e-6) break;
            if (x > t) hi = u; else lo = u;
            u = (lo + hi) * 0.5;
        }
        return sampleY(u);
    };
}

// precompute a pleasant easing used by zoom transitions
const zoomEasing = cubicBezier(0.25, 0.1, 0.25, 1.0);

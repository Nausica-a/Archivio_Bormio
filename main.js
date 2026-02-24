// Core globals and initialization
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

let width = window.innerWidth;
let height = window.innerHeight;
let ratio = window.devicePixelRatio || 1;
canvas.style.width = width + 'px';
canvas.style.height = height + 'px';
canvas.width = Math.floor(width * ratio);
canvas.height = Math.floor(height * ratio);
context.setTransform(ratio, 0, 0, ratio, 0, 0);

let transform = d3.zoomIdentity;
let parallaxStrengthZoom = 0.18;
let isZooming = false;
let lastK = transform.k;
let zoomTimeout = null;
let lastX = transform.x;
let lastY = transform.y;
let isPanning = false;
let panTimeout = null;
let panDelta = { x: 0, y: 0 };
let panParallaxStrength = 0.0009;

let layoutMode = 'umap';
let categoryGroups = [];
let archiveGroups = [];
let yearGroups = [];

const resetBtn = document.getElementById('resetBtn');
const dominantColorsBtn = document.getElementById('dominantColorsBtn');
let filterMode = 'none';
let showDominantColors = false;
let dominantBlend = 0;
let dominantBlendFrom = 0;
let dominantBlendTo = 0;
let dominantBlendStartAt = 0;
let dominantBlendAnimating = false;
const dominantBlendDuration = 260;
const filterInstaBtn = document.getElementById('filterInsta');
const filterArchBtn = document.getElementById('filterArch');
const contemporaryBtn = document.getElementById('contemporaryBtn');
const historicalBtn = document.getElementById('historicalBtn');
const clearFilterBtn = document.getElementById('clearFilter');
const backFromContemporaryBtn = document.getElementById('backFromContemporaryBtn');
const specialViewZoomFactor = 1.8;
let transformBeforeContemporary = null;

function positionContemporaryButton() {
    if (contemporaryBtn) {
        contemporaryBtn.style.position = 'fixed';
        contemporaryBtn.style.left = '12px';
        contemporaryBtn.style.top = '50%';
        contemporaryBtn.style.transform = 'translateY(-50%)';
        contemporaryBtn.style.zIndex = '11';
    }
    if (historicalBtn) {
        historicalBtn.style.position = 'fixed';
        historicalBtn.style.left = 'auto';
        historicalBtn.style.right = '12px';
        historicalBtn.style.top = '50%';
        historicalBtn.style.transform = 'translateY(-50%)';
        historicalBtn.style.zIndex = '11';
    }
}

function cloneZoomTransform(t) {
    if (!t) return d3.zoomIdentity;
    return d3.zoomIdentity.translate(t.x, t.y).scale(t.k);
}

function restoreZoomBeforeContemporary() {
    if (!transformBeforeContemporary) return;
    const targetTransform = transformBeforeContemporary;
    transformBeforeContemporary = null;
    d3.select(canvas)
        .interrupt()
        .transition()
        .duration(320)
        .ease(zoomEasing)
        .call(zoom.transform, targetTransform);
}

function easeInOutCubic(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getDominantBlendValue() {
    if (!dominantBlendAnimating) return dominantBlend;
    const elapsed = performance.now() - dominantBlendStartAt;
    const t = Math.max(0, Math.min(1, elapsed / dominantBlendDuration));
    const eased = easeInOutCubic(t);
    dominantBlend = dominantBlendFrom + (dominantBlendTo - dominantBlendFrom) * eased;
    if (t >= 1) {
        dominantBlend = dominantBlendTo;
        dominantBlendAnimating = false;
    }
    return dominantBlend;
}

function startDominantBlend(toValue) {
    const clampedTo = Math.max(0, Math.min(1, toValue));
    const current = getDominantBlendValue();
    dominantBlendFrom = current;
    dominantBlendTo = clampedTo;
    if (Math.abs(dominantBlendTo - dominantBlendFrom) < 0.001) {
        dominantBlend = dominantBlendTo;
        dominantBlendAnimating = false;
        return;
    }
    dominantBlendStartAt = performance.now();
    dominantBlendAnimating = true;
}

function updateDominantColorsButton(mode = layoutMode) {
    if (!dominantColorsBtn) return;
    const isUmap = mode === 'umap';
    dominantColorsBtn.style.display = isUmap ? '' : 'none';
    dominantColorsBtn.classList.toggle('active', !!showDominantColors && isUmap);
}

function setDominantColorsEnabled(enabled) {
    showDominantColors = !!enabled;
    startDominantBlend(showDominantColors ? 1 : 0);
    updateDominantColorsButton();
    draw();
}

function isContemporaryInstagramImage(d) {
    const category = String(d?.meta?.category || '').trim().toLowerCase();
    return category === 'instagram';
}

function isHistoricalArchiveImage(d) {
    const category = String(d?.meta?.category || '').trim().toLowerCase();
    return category !== 'instagram';
}

function isImageVisibleInCurrentFilter(d) {
    if (filterMode === 'instagram') return !!d.isInstagram;
    if (filterMode === 'archives') return !d.isInstagram;
    if (filterMode === 'contemporary') return isContemporaryInstagramImage(d);
    if (filterMode === 'historical') return isHistoricalArchiveImage(d);
    return true;
}

function getFilterAlphaForImage(d) {
    if (filterMode === 'contemporary') {
        return isContemporaryInstagramImage(d) ? 1.0 : 0.0;
    }
    if (filterMode === 'historical') {
        return isHistoricalArchiveImage(d) ? 1.0 : 0.0;
    }
    if (filterMode === 'instagram') return d.isInstagram ? 1.0 : 0.2;
    if (filterMode === 'archives') return d.isInstagram ? 0.2 : 1.0;
    return 1.0;
}

function focusOnSpecialCluster(mode) {
    if (layoutMode !== 'umap' || !images.length) return;
    const visible = mode === 'historical'
        ? images.filter(isHistoricalArchiveImage)
        : images.filter(isContemporaryInstagramImage);
    if (!visible.length) return;
    const cx = d3.mean(visible, d => d.x);
    const cy = d3.mean(visible, d => d.y);
    const targetScale = Math.max(0.3, Math.min(12, transform.k * specialViewZoomFactor));
    const focusTransform = d3.zoomIdentity.scale(targetScale).translate(-cx, -cy);
    d3.select(canvas).interrupt().transition().duration(450).ease(zoomEasing).call(zoom.transform, focusTransform);
}

function updateSpecialButtons(mode = layoutMode) {
    const isUmap = mode === 'umap';
    const specialActive = (filterMode === 'contemporary' || filterMode === 'historical') && isUmap;
    if (contemporaryBtn) {
        const contemporaryActive = filterMode === 'contemporary' && isUmap;
        contemporaryBtn.classList.toggle('hidden', !isUmap || specialActive);
        contemporaryBtn.classList.toggle('active', contemporaryActive);
    }
    if (historicalBtn) {
        const historicalActive = filterMode === 'historical' && isUmap;
        historicalBtn.classList.toggle('hidden', !isUmap || specialActive);
        historicalBtn.classList.toggle('active', historicalActive);
    }
    if (backFromContemporaryBtn) {
        backFromContemporaryBtn.classList.toggle('hidden', !specialActive);
    }
}

function clearContemporaryFilterIfNeeded(targetMode) {
    if (targetMode !== 'umap' && (filterMode === 'contemporary' || filterMode === 'historical')) {
        filterMode = 'none';
        restoreZoomBeforeContemporary();
    }
}

function updateFilterButtons(){
    if (!filterInstaBtn || !filterArchBtn) return;
    filterInstaBtn.classList.toggle('active', filterMode === 'instagram');
    filterArchBtn.classList.toggle('active', filterMode === 'archives');
    updateSpecialButtons();
    if (clearFilterBtn) clearFilterBtn.classList.toggle('hidden', filterMode === 'none');
}
if (filterInstaBtn) filterInstaBtn.addEventListener('click', () => { filterMode = (filterMode === 'instagram') ? 'none' : 'instagram'; updateFilterButtons(); draw(); });
if (filterArchBtn) filterArchBtn.addEventListener('click', () => { filterMode = (filterMode === 'archives') ? 'none' : 'archives'; updateFilterButtons(); draw(); });
if (contemporaryBtn) contemporaryBtn.addEventListener('click', () => {
    if (layoutMode !== 'umap') return;
    if (filterMode !== 'contemporary') {
        transformBeforeContemporary = cloneZoomTransform(transform);
    }
    filterMode = (filterMode === 'contemporary') ? 'none' : 'contemporary';
    updateFilterButtons();
    draw();
    if (filterMode === 'contemporary') {
        focusOnSpecialCluster('contemporary');
    } else {
        restoreZoomBeforeContemporary();
    }
});
if (historicalBtn) historicalBtn.addEventListener('click', () => {
    if (layoutMode !== 'umap') return;
    if (filterMode !== 'historical') {
        transformBeforeContemporary = cloneZoomTransform(transform);
    }
    filterMode = (filterMode === 'historical') ? 'none' : 'historical';
    updateFilterButtons();
    draw();
    if (filterMode === 'historical') {
        focusOnSpecialCluster('historical');
    } else {
        restoreZoomBeforeContemporary();
    }
});
if (backFromContemporaryBtn) backFromContemporaryBtn.addEventListener('click', () => {
    if (filterMode !== 'contemporary' && filterMode !== 'historical') return;
    filterMode = 'none';
    updateFilterButtons();
    draw();
    restoreZoomBeforeContemporary();
});
if (clearFilterBtn) clearFilterBtn.addEventListener('click', () => {
    if (filterMode === 'contemporary' || filterMode === 'historical') restoreZoomBeforeContemporary();
    filterMode = 'none';
    updateFilterButtons();
    draw();
});
updateFilterButtons();
requestAnimationFrame(positionContemporaryButton);

let baseSize = 18;
let images = [];
let xScale, yScale;
let defaultUmapTransform = d3.zoomIdentity;
const UMAP_ANCHOR_FILENAME = 'sa6573.jpg';
const UMAP_RIGHT_SIDE_Y_OFFSET = 320;
const UMAP_RIGHT_SIDE_X_OFFSET = -300;

function rgbToHex(r, g, b) {
    const toHex = (v) => {
        const clamped = Math.max(0, Math.min(255, Math.round(v)));
        return clamped.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function computeDominantColorFromImage(img) {
    const defaultColor = '#808080';
    try {
        const nw = img.naturalWidth || img.width || 0;
        const nh = img.naturalHeight || img.height || 0;
        if (!nw || !nh) return defaultColor;

        const maxSide = 56;
        const scale = Math.min(1, maxSide / Math.max(nw, nh));
        const sw = Math.max(1, Math.round(nw * scale));
        const sh = Math.max(1, Math.round(nh * scale));

        const offscreen = document.createElement('canvas');
        offscreen.width = sw;
        offscreen.height = sh;
        const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
        if (!offCtx) return defaultColor;

        offCtx.drawImage(img, 0, 0, sw, sh);
        const data = offCtx.getImageData(0, 0, sw, sh).data;
        const pixelCount = sw * sh;
        const step = pixelCount > 5000 ? Math.ceil(pixelCount / 5000) : 1;

        const buckets = new Map();
        for (let p = 0; p < pixelCount; p += step) {
            const i = p * 4;
            const a = data[i + 3];
            if (a < 80) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
            const bucket = buckets.get(key) || { count: 0, rSum: 0, gSum: 0, bSum: 0 };
            bucket.count += 1;
            bucket.rSum += r;
            bucket.gSum += g;
            bucket.bSum += b;
            buckets.set(key, bucket);
        }

        const orderedBuckets = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
        if (!orderedBuckets.length) return defaultColor;

        const toAvgRgb = (bucket) => ({
            r: bucket.rSum / bucket.count,
            g: bucket.gSum / bucket.count,
            b: bucket.bSum / bucket.count
        });
        const getSaturation = ({ r, g, b }) => {
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (max <= 0) return 0;
            return (max - min) / max;
        };
        const isNearBlack = ({ r, g, b }) => {
            const max = Math.max(r, g, b);
            const avg = (r + g + b) / 3;
            return max < 42 || avg < 30;
        };
        const isSaturatedVisibleColor = (rgb) => {
            const sat = getSaturation(rgb);
            const max = Math.max(rgb.r, rgb.g, rgb.b);
            return sat >= 0.28 && max >= 55;
        };

        const dominantRgb = toAvgRgb(orderedBuckets[0]);
        if (!isNearBlack(dominantRgb)) {
            return rgbToHex(dominantRgb.r, dominantRgb.g, dominantRgb.b);
        }

        for (let i = 1; i < orderedBuckets.length; i++) {
            const candidate = toAvgRgb(orderedBuckets[i]);
            if (isNearBlack(candidate)) continue;
            if (!isSaturatedVisibleColor(candidate)) continue;
            return rgbToHex(candidate.r, candidate.g, candidate.b);
        }

        for (let i = 1; i < orderedBuckets.length; i++) {
            const candidate = toAvgRgb(orderedBuckets[i]);
            if (!isNearBlack(candidate)) return rgbToHex(candidate.r, candidate.g, candidate.b);
        }

        return rgbToHex(dominantRgb.r, dominantRgb.g, dominantRgb.b);
    } catch (error) {
        return defaultColor;
    }
}

function updateDefaultUmapTransform() {
    if (!images.length) {
        defaultUmapTransform = d3.zoomIdentity;
        return;
    }
    const xExt = d3.extent(images, d => d.umapX);
    const yExt = d3.extent(images, d => d.umapY);
    const cx = ((xExt[0] ?? 0) + (xExt[1] ?? 0)) / 2;
    const cy = ((yExt[0] ?? 0) + (yExt[1] ?? 0)) / 2;
    defaultUmapTransform = d3.zoomIdentity.translate(-cx, -cy);
}

function getRenderedThumbnailSize(d) {
    const kImg = Math.max(0.3, Math.min(12, transform.k));
    let scaleFactorImg;
    if (kImg >= 1) scaleFactorImg = Math.pow(kImg, 1.08);
    else scaleFactorImg = Math.pow(kImg, 1.4);
    const size = Math.max(6, Math.min(135, Math.round(baseSize * scaleFactorImg)));

    const iw = d.img.naturalWidth || d.img.width || 1;
    const ih = d.img.naturalHeight || d.img.height || 1;
    const aspect = iw / ih;
    if (aspect >= 1) {
        return { w: size, h: Math.max(1, Math.round(size / aspect)) };
    }
    return { w: Math.max(1, Math.round(size * aspect)), h: size };
}

function drawLoadError(message) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.fillStyle = '#ffffff';
    context.font = '15px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const lines = String(message || 'Errore di caricamento dati').split('\n');
    const startY = height / 2 - ((lines.length - 1) * 12);
    lines.forEach((line, index) => {
        context.fillText(line, width / 2, startY + index * 24);
    });
    context.restore();
}

// modal elements (used by openModal/closeModal)
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');
const closeBtn = document.getElementById('modal-close');
const metaYear = document.getElementById('meta-year');
const metaDesc = document.getElementById('meta-desc');
const metaCat = document.getElementById('meta-cat');
const metaTags = document.getElementById('meta-tags');

// zoom setup
const zoom = d3.zoom()
    .scaleExtent([0.3, 12])
    .filter((event) => {
        if (event && event.type === 'wheel') return false;
        return true;
    })
    .on("zoom", (event) => {
        transform = event.transform;
        // when scale changes, briefly enable parallax effect
        if (transform.k !== lastK) {
            isZooming = true;
            if (zoomTimeout) clearTimeout(zoomTimeout);
            zoomTimeout = setTimeout(() => { isZooming = false; draw(); }, 300);
            lastK = transform.k;
        }
        const dx = transform.x - lastX;
        const dy = transform.y - lastY;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            isPanning = true;
            panDelta.x = dx;
            panDelta.y = dy;
            if (panTimeout) clearTimeout(panTimeout);
            panTimeout = setTimeout(() => { isPanning = false; panDelta.x = 0; panDelta.y = 0; draw(); }, 260);
        }
        lastX = transform.x;
        lastY = transform.y;
        draw();
    });

d3.select(canvas).call(zoom);

// load data and initialize images
Promise.all([d3.csv("coordinates.csv"), d3.csv("insta_siamoalpi.csv")]).then(([coords, meta]) => {
    const metaMap = {};
    meta.forEach(m => { if (m && m.filename) metaMap[m.filename] = m; });
    const normalizeName = (v) => String(v || '').trim().toLowerCase();
    const anchorRow = coords.find(d => d && normalizeName(d.filename) === normalizeName(UMAP_ANCHOR_FILENAME));
    const anchorX = anchorRow ? +anchorRow.x : null;
    const isShiftedRightSide = (row) => anchorX !== null && Number.isFinite(anchorX) && +row.x >= anchorX;

    const xExtent = d3.extent(coords, d => +d.x);
    const yExtent = d3.extent(coords, d => +d.y);

    const updateScales = () => {
        xScale = d3.scaleLinear().domain(xExtent).range([-width/2, width/2]);
        yScale = d3.scaleLinear().domain(yExtent).range([-height/2, height/2]);
    };
    updateScales();

    coords.forEach(d => {
        const img = new Image();
        img.src = "thumbs/" + d.filename;

        const depthNorm = (+d.y - yExtent[0]) / ( (yExtent[1] - yExtent[0]) || 1 );
        const isShifted = isShiftedRightSide(d);
        const ux = xScale(+d.x) + (isShifted ? UMAP_RIGHT_SIDE_X_OFFSET : 0);
        const uy = yScale(+d.y) + (isShifted ? UMAP_RIGHT_SIDE_Y_OFFSET : 0);
        const mobj = metaMap[d.filename] || {};
        const isInsta = String(getArchiveLabel(mobj) || '').toLowerCase().includes('insta') || String(getLabel(mobj) || '').toLowerCase().includes('insta');
        const imageItem = {
            img: img,
            x: ux,
            y: uy,
            umapX: ux,
            umapY: uy,
            depth: Math.max(0, Math.min(1, depthNorm)),
            filename: d.filename,
            meta: metaMap[d.filename],
            isInstagram: isInsta,
            dominantColor: '#808080'
        };
        img.onload = () => {
            imageItem.dominantColor = computeDominantColorFromImage(img);
            draw();
        };
        img.onerror = () => draw();
        images.push(imageItem);
    });

    updateDefaultUmapTransform();
    d3.select(canvas).call(zoom.transform, defaultUmapTransform);

    draw();

    window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;
        ratio = window.devicePixelRatio || 1;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        updateScales();
        coords.forEach((d,i) => {
            if (images[i]) {
                const isShifted = isShiftedRightSide(d);
                const ux = xScale(+d.x) + (isShifted ? UMAP_RIGHT_SIDE_X_OFFSET : 0);
                const uy = yScale(+d.y) + (isShifted ? UMAP_RIGHT_SIDE_Y_OFFSET : 0);
                images[i].umapX = ux;
                images[i].umapY = uy;
                if (layoutMode === 'umap') {
                    images[i].x = ux;
                    images[i].y = uy;
                }
            }
        });
        updateDefaultUmapTransform();
        if (layoutMode === 'category') {
            computeCategoryPositions();
            images.forEach(d => { if (typeof d.catX === 'number') { d.x = d.catX; d.y = d.catY; } });
        }
        if (layoutMode === 'archivio') {
            computeArchivePositions();
            images.forEach(d => { if (typeof d.archX === 'number') { d.x = d.archX; d.y = d.archY; } });
        }
        if (layoutMode === 'year') {
            computeYearPositions();
            images.forEach(d => { if (typeof d.yearX === 'number') { d.x = d.yearX; d.y = d.yearY; } });
        }
        positionContemporaryButton();
        draw();
    });
}).catch((error) => {
    console.error('Errore nel caricamento dei dati:', error);
    drawLoadError('Impossibile caricare i dati (CSV).\nApri il progetto da server locale: http://localhost:8000');
});

// click detection to open modal
canvas.addEventListener('click', (event) => {
    const p = d3.pointer(event, canvas);
    for (let i = images.length - 1; i >= 0; --i) {
        const d = images[i];
        if (!d.img.complete) continue;
        if ((d.img.naturalWidth || 0) <= 0 || (d.img.naturalHeight || 0) <= 0) continue;
        if (!isImageVisibleInCurrentFilter(d)) continue;
        const sx = transform.x + width/2 + transform.k * d.x;
        const sy = transform.y + height/2 + transform.k * d.y;
        // compute image size based on zoom level (match draw() behavior)
        const { w, h } = getRenderedThumbnailSize(d);

        if (p[0] >= sx - w/2 && p[0] <= sx + w/2 && p[1] >= sy - h/2 && p[1] <= sy + h/2) {
            openModal(d);
            return;
        }
    }
});

// double-click to zoom centered at pointer
d3.select(canvas).on('dblclick', (event) => {
    const p = d3.pointer(event);
    const newScale = Math.min(transform.k * 2.5, 20);
    d3.select(canvas).transition().duration(150).ease(zoomEasing).call(zoom.scaleTo, newScale, p);
});

// custom wheel zoom handling
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const sensitivity = 0.06;
    const delta = -event.deltaY;
    // amplify zoom-in gestures more than zoom-out to feel stronger when enlarging
    const boostIn = 1.8;
    const boostOut = 0.9;
    const boost = delta > 0 ? boostIn : boostOut;
    const factor = Math.exp(delta * sensitivity * boost);
    const p = d3.pointer(event, canvas);
    const worldX = (p[0] - transform.x - width / 2) / transform.k;
    const worldY = (p[1] - transform.y - height / 2) / transform.k;
    const center = [worldX, worldY];
    const target = Math.max(0.3, Math.min(12, transform.k * factor));
    d3.select(canvas).interrupt().transition().duration(60).ease(zoomEasing).call(zoom.scaleTo, target, center);
}, { passive: false });

// layout state and button wiring

if (dominantColorsBtn) dominantColorsBtn.addEventListener('click', () => {
    if (layoutMode !== 'umap') return;
    setDominantColorsEnabled(!showDominantColors);
});
updateDominantColorsButton();

const categoryBtn = document.getElementById('categoryBtn');
if (categoryBtn) categoryBtn.addEventListener('click', () => {
    if (layoutMode === 'category') {
        updateDominantColorsButton('umap');
        updateSpecialButtons('umap');
        animateToLayout('umap');
    }
    else {
        clearContemporaryFilterIfNeeded('category');
        setDominantColorsEnabled(false);
        updateDominantColorsButton('category');
        updateSpecialButtons('category');
        updateFilterButtons();
        animateToLayout('category');
    }
});

const archiveBtn = document.getElementById('archiveBtn');
if (archiveBtn) archiveBtn.addEventListener('click', () => {
    if (layoutMode === 'archivio') {
        updateDominantColorsButton('umap');
        updateSpecialButtons('umap');
        animateToLayout('umap');
    }
    else {
        clearContemporaryFilterIfNeeded('archivio');
        setDominantColorsEnabled(false);
        updateDominantColorsButton('archivio');
        updateSpecialButtons('archivio');
        updateFilterButtons();
        animateToLayout('archivio');
    }
});

const yearBtn = document.getElementById('yearBtn');
if (yearBtn) yearBtn.addEventListener('click', () => {
    if (layoutMode === 'year') {
        updateDominantColorsButton('umap');
        updateSpecialButtons('umap');
        animateToLayout('umap');
    }
    else {
        clearContemporaryFilterIfNeeded('year');
        setDominantColorsEnabled(false);
        updateDominantColorsButton('year');
        updateSpecialButtons('year');
        updateFilterButtons();
        if (typeof computeYearPositions === 'function') computeYearPositions();
        const hasYearTargets = images.some(d => Number.isFinite(d.yearX) && Number.isFinite(d.yearY));
        if (hasYearTargets) animateToLayout('year');
        else {
            layoutMode = 'year';
            draw();
        }
    }
});

// reset button
if (resetBtn) resetBtn.addEventListener('click', () => {
    setDominantColorsEnabled(false);
    updateDominantColorsButton('umap');
    updateSpecialButtons('umap');
    categoryGroups = [];
    archiveGroups = [];
    yearGroups = [];
    draw();
    animateToLayout('umap');
    updateDefaultUmapTransform();
    d3.select(canvas).transition().duration(150).ease(zoomEasing).call(zoom.transform, defaultUmapTransform);
});

// modal close bindings
if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

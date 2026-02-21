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

const resetBtn = document.getElementById('resetBtn');
let filterMode = 'none';
const filterInstaBtn = document.getElementById('filterInsta');
const filterArchBtn = document.getElementById('filterArch');
const clearFilterBtn = document.getElementById('clearFilter');
function updateFilterButtons(){
    if (!filterInstaBtn || !filterArchBtn) return;
    filterInstaBtn.classList.toggle('active', filterMode === 'instagram');
    filterArchBtn.classList.toggle('active', filterMode === 'archives');
    if (clearFilterBtn) clearFilterBtn.classList.toggle('hidden', filterMode === 'none');
}
if (filterInstaBtn) filterInstaBtn.addEventListener('click', () => { filterMode = (filterMode === 'instagram') ? 'none' : 'instagram'; updateFilterButtons(); draw(); });
if (filterArchBtn) filterArchBtn.addEventListener('click', () => { filterMode = (filterMode === 'archives') ? 'none' : 'archives'; updateFilterButtons(); draw(); });
if (clearFilterBtn) clearFilterBtn.addEventListener('click', () => { filterMode = 'none'; updateFilterButtons(); draw(); });
updateFilterButtons();

let baseSize = 18;
let images = [];
let xScale, yScale;

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
        img.onload = () => draw();

        const depthNorm = (+d.y - yExtent[0]) / ( (yExtent[1] - yExtent[0]) || 1 );
        const ux = xScale(+d.x);
        const uy = yScale(+d.y);
        const mobj = metaMap[d.filename] || {};
        const isInsta = String(getArchiveLabel(mobj) || '').toLowerCase().includes('insta') || String(getLabel(mobj) || '').toLowerCase().includes('insta');
        images.push({
            img: img,
            x: ux,
            y: uy,
            umapX: ux,
            umapY: uy,
            depth: Math.max(0, Math.min(1, depthNorm)),
            filename: d.filename,
            meta: metaMap[d.filename],
            isInstagram: isInsta
        });
    });

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
                const ux = xScale(+d.x);
                const uy = yScale(+d.y);
                images[i].umapX = ux;
                images[i].umapY = uy;
                if (layoutMode === 'umap') {
                    images[i].x = ux;
                    images[i].y = uy;
                }
            }
        });
        if (layoutMode === 'category') {
            computeCategoryPositions();
            images.forEach(d => { if (typeof d.catX === 'number') { d.x = d.catX; d.y = d.catY; } });
        }
        if (layoutMode === 'archivio') {
            computeArchivePositions();
            images.forEach(d => { if (typeof d.archX === 'number') { d.x = d.archX; d.y = d.archY; } });
        }
        draw();
    });
});

// click detection to open modal
canvas.addEventListener('click', (event) => {
    const p = d3.pointer(event, canvas);
    for (let i = images.length - 1; i >= 0; --i) {
        const d = images[i];
        if (!d.img.complete) continue;
        const sx = transform.x + width/2 + transform.k * d.x;
        const sy = transform.y + height/2 + transform.k * d.y;
        // compute image size based on zoom level (match draw() behavior)
        const kImg = Math.max(0.3, Math.min(12, transform.k));
        let scaleFactorImg;
        if (kImg >= 1) scaleFactorImg = Math.pow(kImg, 1.08);
        else scaleFactorImg = Math.pow(kImg, 1.4);
        let size = Math.max(6, Math.min(110, Math.round(baseSize * scaleFactorImg)));
        const iw = d.img.naturalWidth || d.img.width || 1;
        const ih = d.img.naturalHeight || d.img.height || 1;
        const aspect = iw / ih;
        let w, h;
        if (aspect >= 1) { w = size; h = Math.max(1, Math.round(size / aspect)); }
        else { w = Math.max(1, Math.round(size * aspect)); h = size; }

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
let layoutMode = 'umap';
let categoryGroups = [];
let archiveGroups = [];

const categoryBtn = document.getElementById('categoryBtn');
if (categoryBtn) categoryBtn.addEventListener('click', () => {
    if (layoutMode === 'category') animateToLayout('umap');
    else animateToLayout('category');
});

const archiveBtn = document.getElementById('archiveBtn');
if (archiveBtn) archiveBtn.addEventListener('click', () => {
    if (layoutMode === 'archivio') animateToLayout('umap');
    else animateToLayout('archivio');
});

// reset button
if (resetBtn) resetBtn.addEventListener('click', () => {
    categoryGroups = [];
    archiveGroups = [];
    draw();
    animateToLayout('umap');
    d3.select(canvas).transition().duration(150).ease(zoomEasing).call(zoom.transform, d3.zoomIdentity);
});

// modal close bindings
if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

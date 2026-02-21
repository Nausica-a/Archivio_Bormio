function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    const margin = 100;
    const zoomParallax = isZooming ? (transform.k - 1) * parallaxStrengthZoom : 0;

    images.forEach(d => {
        if (!d.img.complete) return;

        let sx = transform.x + width/2 + transform.k * d.x;
        let sy = transform.y + height/2 + transform.k * d.y;

        const depth = (typeof d.depth === 'number') ? d.depth : 0.5;
        if (zoomParallax !== 0) {
            const fromCenterX = sx - width / 2;
            const fromCenterY = sy - height / 2;
            sx += fromCenterX * depth * zoomParallax;
            sy += fromCenterY * depth * zoomParallax;
        }
        if (isPanning && (panDelta.x !== 0 || panDelta.y !== 0)) {
            sx += panDelta.x * depth * panParallaxStrength * (1 / Math.max(0.5, transform.k));
            sy += panDelta.y * depth * panParallaxStrength * (1 / Math.max(0.5, transform.k));
        }

        // compute image size based on zoom level around baseSize==18
        // stronger growth when zooming in, stronger shrink when zooming out
        const k = Math.max(0.3, Math.min(12, transform.k));
        let scaleFactor;
        // soften the effect: milder growth/shrink around baseSize
        if (k >= 1) scaleFactor = Math.pow(k, 1.08);
        else scaleFactor = Math.pow(k, 1.4);
        let size = Math.max(6, Math.min(110, Math.round(baseSize * scaleFactor)));
        const iw = d.img.naturalWidth || d.img.width || 1;
        const ih = d.img.naturalHeight || d.img.height || 1;
        const aspect = iw / ih;
        let w, h;
        if (aspect >= 1) {
            w = size;
            h = Math.max(1, Math.round(size / aspect));
        } else {
            w = Math.max(1, Math.round(size * aspect));
            h = size;
        }

        if (sx + w/2 < -margin || sx - w/2 > width + margin || sy + h/2 < -margin || sy - h/2 > height + margin) return;

        let alpha = 1.0;
        if (filterMode === 'instagram') alpha = d.isInstagram ? 1.0 : 0.2;
        else if (filterMode === 'archives') alpha = d.isInstagram ? 0.2 : 1.0;
        context.save();
        context.globalAlpha = alpha;
        context.drawImage(d.img, sx - w/2, sy - h/2, w, h);
        context.restore();
    });

    const groupsToDraw = (layoutMode === 'archivio') ? archiveGroups : categoryGroups;
    if (groupsToDraw && groupsToDraw.length) {
        context.save();
        context.textAlign = 'center';
        context.textBaseline = 'top';
        const fontSize = Math.max(11, Math.round(12 * Math.min(1.5, transform.k)));
        context.font = fontSize + 'px sans-serif';
        context.fillStyle = '#ffffff';
        groupsToDraw.forEach(g => {
            const sx = transform.x + width/2 + transform.k * g.cx;
            const sy = transform.y + height/2 + transform.k * g.cy;
            // label position varies with cluster radius and zoom, always below cluster
            const scaledRadius = transform.k * g.radius;
            const labelDistance = Math.max(scaledRadius * 1.2, 50); // at least 20% below radius, minimum 50px
            const labelY = sy + labelDistance + 15; // additional offset for readability
            context.fillText(g.label, sx, labelY);
        });
        context.restore();
    }
}

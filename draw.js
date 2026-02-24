function draw() {
    if (typeof positionContemporaryButton === 'function') {
        positionContemporaryButton();
    }
    context.clearRect(0, 0, canvas.width, canvas.height);

    const margin = 100;
    const zoomParallax = isZooming ? (transform.k - 1) * parallaxStrengthZoom : 0;
    const dominantBlendValue = (layoutMode === 'umap' && typeof getDominantBlendValue === 'function')
        ? getDominantBlendValue()
        : 0;

    images.forEach(d => {
        if (!d.img.complete) return;
        if ((d.img.naturalWidth || 0) <= 0 || (d.img.naturalHeight || 0) <= 0) return;

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

        const { w, h } = getRenderedThumbnailSize(d);

        if (sx + w/2 < -margin || sx - w/2 > width + margin || sy + h/2 < -margin || sy - h/2 > height + margin) return;

        const alpha = (typeof getFilterAlphaForImage === 'function')
            ? getFilterAlphaForImage(d)
            : 1.0;
        if (alpha <= 0.001) return;
        context.save();
        if (dominantBlendValue > 0 && layoutMode === 'umap') {
            const photoAlpha = alpha * (1 - dominantBlendValue);
            if (photoAlpha > 0.001) {
                context.globalAlpha = photoAlpha;
                context.drawImage(d.img, sx - w/2, sy - h/2, w, h);
            }

            const colorAlpha = alpha * dominantBlendValue;
            context.globalAlpha = colorAlpha;
            context.fillStyle = d.dominantColor || '#808080';
            context.fillRect(sx - w/2, sy - h/2, w, h);
        } else {
            context.globalAlpha = alpha;
            context.drawImage(d.img, sx - w/2, sy - h/2, w, h);
        }
        context.restore();
    });

    if (dominantBlendAnimating) {
        requestAnimationFrame(draw);
    }

    let groupsToDraw = [];
    if (layoutMode === 'archivio') groupsToDraw = archiveGroups;
    else if (layoutMode === 'category') groupsToDraw = categoryGroups;
    else if (layoutMode === 'year') groupsToDraw = yearGroups;
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

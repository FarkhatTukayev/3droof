window.dormerConfig = [];
window.needs3DUpdate = true;
window.needsCalcUpdate = true;
window.materialColorMap = {};
window.cameraInitialized = false;
window.wasteVisible = false;

document.addEventListener('DOMContentLoaded', async () => {
    const mainTooltip = document.createElement('div');
    mainTooltip.id = 'globalTooltip';
    mainTooltip.className = 'global-tooltip';
    document.body.appendChild(mainTooltip);

    await loadPrices();
    if (typeof init3D === 'function') {
        init3D();
    }
    setupEventListeners();
    recalculateNumbers();
});

async function loadPrices() {
    try {
        const res = await fetch('prices.json');
        window.currentPrices = await res.json();
        const data = window.currentPrices;

        const matContainer = document.getElementById('materialSwatchesContainer');
        const matInput = document.getElementById('material');
        const colorMap = {};

        if (matContainer) {
            matContainer.innerHTML = '';
            data.materials.forEach(m => {
                const wrapper = document.createElement('div');
                wrapper.className = 'swatch-wrapper';

                const swatch = document.createElement('div');
                swatch.className = 'swatch';
                if (m.selected) {
                    swatch.classList.add('selected');
                    wrapper.classList.add('selected');
                    matInput.value = m.price;
                }
                let colorHex = '#334155';
                if (m.color !== undefined) {
                    let parsedColor = typeof m.color === 'string' ? parseInt(m.color, 16) : m.color;
                    colorHex = '#' + parsedColor.toString(16).padStart(6, '0');
                }
                swatch.style.backgroundColor = colorHex;
                wrapper.setAttribute('data-tooltip', `${m.name} - ${m.price.toLocaleString('ru-RU')} ₸/м²`);

                wrapper.addEventListener('mouseenter', () => {
                    const gt = document.getElementById('globalTooltip');
                    if (gt) {
                        gt.textContent = wrapper.getAttribute('data-tooltip');
                        const rect = wrapper.getBoundingClientRect();
                        gt.style.left = rect.left + rect.width / 2 + 'px';
                        gt.style.top = rect.top - 8 + 'px';
                        gt.classList.add('show');
                    }
                });
                wrapper.addEventListener('mouseleave', () => {
                    const gt = document.getElementById('globalTooltip');
                    if (gt) gt.classList.remove('show');
                });

                const icons = {
                    'metal_econom': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M2 14l5-5 5 5 5-5 5 5"/><path d="M2 20l5-5 5 5 5-5 5 5"/></svg>',
                    'metal_premium': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M2 10l5-5 5 5 5-5 5 5"/><path d="M2 16l5-5 5 5 5-5 5 5"/><path d="M2 22l5-5 5 5 5-5 5 5"/></svg>',
                    'prof': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M4 4v16M8 4v16M12 4v16M16 4v16M20 4v16"/></svg>',
                    'soft': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="3" y="4" width="8" height="6" rx="1"/><rect x="13" y="4" width="8" height="6" rx="1"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>',
                    'comp': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>'
                };

                swatch.innerHTML = icons[m.id] || '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/></svg>';

                const label = document.createElement('div');
                label.className = 'swatch-label';

                // Keep label short
                let shortName = m.name;
                if (shortName.includes('Металлочерепица')) shortName = shortName.replace('Металлочерепица', 'Металлочер.');
                if (shortName.includes('Композитная черепица')) shortName = 'Комп. черепица';
                if (shortName.includes('Мягкая кровля (Битумная)')) shortName = 'Мягкая кровля';

                label.textContent = shortName;

                wrapper.appendChild(swatch);
                wrapper.appendChild(label);

                wrapper.onclick = () => {
                    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
                    document.querySelectorAll('.swatch-wrapper').forEach(w => w.classList.remove('selected'));
                    swatch.classList.add('selected');
                    wrapper.classList.add('selected');
                    matInput.value = m.price;
                    window.needs3DUpdate = true;
                    window.needsCalcUpdate = true;
                    recalculateNumbers();
                };
                matContainer.appendChild(wrapper);
                colorMap[m.price] = parseInt(m.color);
            });
        }
        window.materialColorMap = colorMap;
        document.getElementById('labor').value = data.labor.defaultRate;
    } catch (err) {
        console.error("Failed to fetch prices:", err);
    }
}

function setupEventListeners() {
    const roofShapeInput = document.getElementById('roofShape');
    const shapeRadios = document.querySelectorAll('input[name="roofShapeRadio"]');

    const lengthInput = document.getElementById('length');
    const widthInput = document.getElementById('width');
    const overhangInput = document.getElementById('overhang');
    const angleInput = document.getElementById('angle');

    const materialSel = document.getElementById('material');
    const wasteInput = document.getElementById('waste');
    const sheetWidthInput = document.getElementById('sheetWidth');
    const laborInput = document.getElementById('labor');

    const includeInsulationCb = document.getElementById('includeInsulation');
    const includeWoodCb = document.getElementById('includeWood');
    const resetBtn = document.getElementById('resetBtn');
    const themeToggle = document.getElementById('themeToggle');
    const addDormerBtn = document.getElementById('addDormerBtn');
    const showWasteBtn = document.getElementById('showWasteBtn');

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️ Светлая';
    }

    themeToggle.addEventListener('click', () => {
        if (document.documentElement.getAttribute('data-theme') === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeToggle.textContent = '🌙 Тёмная';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.textContent = '☀️ Светлая';
        }
    });

    ['length', 'width', 'overhang', 'angle'].forEach(id => {
        const inp = document.getElementById(id);
        const valSpan = document.getElementById(id + 'Val');
        if (inp && valSpan) {
            inp.addEventListener('input', () => {
                valSpan.textContent = inp.value;
            });
        }
    });

    shapeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                roofShapeInput.value = e.target.value;
                roofShapeInput.dispatchEvent(new Event('change'));
            }
        });
    });

    ['input', 'change'].forEach(eventType => {
        [roofShapeInput, wasteInput, sheetWidthInput, laborInput, overhangInput, includeInsulationCb, includeWoodCb].forEach(el => {
            if (!el) return;
            el.addEventListener(eventType, () => {
                window.needsCalcUpdate = true;
                if (el === roofShapeInput || el === overhangInput || el === wasteInput) {
                    window.needs3DUpdate = true;
                }

                if (el === roofShapeInput) {
                    const angleGroup = document.getElementById('angleGroup');
                    const dormerSection = document.getElementById('dormerSection');
                    const angleLabelText = document.getElementById('angleLabelText');

                    if (roofShapeInput.value === 'flat') {
                        angleGroup.style.display = 'none';
                    } else {
                        angleGroup.style.display = 'block';
                        angleLabelText.textContent = roofShapeInput.value === 'mansard' ? 'Крутизна нижнего ската:' : 'Угол наклона:';
                    }

                    const isGableOrHip = roofShapeInput.value === 'gable' || roofShapeInput.value === 'hip';
                    dormerSection.style.display = isGableOrHip ? 'block' : 'none';

                    if (window.dormerConfig && window.dormerConfig.length > 0) {
                        const isHip = roofShapeInput.value === 'hip' || roofShapeInput.value === 'mansard';
                        let changed = false;
                        if (!isHip) {
                            window.dormerConfig.forEach(d => {
                                if (d.side === 'front' || d.side === 'back') {
                                    d.side = 'right';
                                    changed = true;
                                }
                            });
                        }
                        if (changed) {
                            window.validateDormers();
                            renderDormerUI();
                            window.needs3DUpdate = true;
                        }
                    }
                }

                if (window.needsCalcUpdate) recalculateNumbers();
            });
        });
    });

    if (angleInput) {
        angleInput.addEventListener('input', () => {
            window.needs3DUpdate = true;
            recalculateNumbers();
        });
    }

    window.validateDormers = function () {
        const len = parseFloat(lengthInput ? lengthInput.value : 10) || 10;
        const wid = parseFloat(widthInput ? widthInput.value : 8) || 8;
        if (window.dormerConfig) {
            let changed = false;
            window.dormerConfig.forEach(dormer => {
                let maxWidth = (dormer.side === 'front' || dormer.side === 'back') ? wid : len;
                if (dormer.width > maxWidth) {
                    dormer.width = maxWidth;
                    changed = true;
                }

                let maxPos;
                if (dormer.side === 'front' || dormer.side === 'back') {
                    maxPos = Math.max(0, (wid / 2) - (dormer.width / 2));
                } else {
                    maxPos = Math.max(0, (len / 2) - (dormer.width / 2));
                }

                let pos = parseFloat(dormer.position);
                if (pos > maxPos) { dormer.position = maxPos; changed = true; }
                if (pos < -maxPos) { dormer.position = -maxPos; changed = true; }
            });
            if (changed) renderDormerUI();
        }
    };

    [lengthInput, widthInput].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => {
            window.needs3DUpdate = true;
            window.validateDormers();
            renderDormerUI();
            recalculateNumbers();
        });
    });

    if (addDormerBtn) {
        addDormerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('dormerSection').open = true;
            window.dormerConfig.push({ width: 3, projection: 1.5, position: 0, side: 'right' });
            renderDormerUI();
            window.needs3DUpdate = true;
            recalculateNumbers();
        });
    }

    const totalSumContainer = document.getElementById('totalSumContainer');
    const detailedBlock = document.getElementById('detailedMaterialsBlock');
    const receiptChevron = document.getElementById('receiptChevron');
    if (totalSumContainer && detailedBlock) {
        totalSumContainer.addEventListener('click', () => {
            if (detailedBlock.style.display === 'none') {
                detailedBlock.style.display = 'block';
                receiptChevron.textContent = '▲';
            } else {
                detailedBlock.style.display = 'none';
                receiptChevron.textContent = '▼';
            }
        });
    }

    if (showWasteBtn) {
        showWasteBtn.addEventListener('click', () => {
            window.wasteVisible = !window.wasteVisible;
            showWasteBtn.classList.toggle('active', window.wasteVisible);
            showWasteBtn.style.backgroundColor = window.wasteVisible ? 'rgba(239, 68, 68, 0.1)' : '';
            window.needs3DUpdate = true;
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            lengthInput.value = 10; document.getElementById('lengthVal').textContent = "10";
            widthInput.value = 8; document.getElementById('widthVal').textContent = "8";
            angleInput.value = 30; document.getElementById('angleVal').textContent = "30";
            overhangInput.value = 0.5; document.getElementById('overhangVal').textContent = "0.5";

            const firstRadio = document.querySelector('input[name="roofShapeRadio"][value="gable"]');
            if (firstRadio) firstRadio.checked = true;
            roofShapeInput.value = "gable";
            roofShapeInput.dispatchEvent(new Event('change'));

            wasteInput.value = 15;
            sheetWidthInput.value = 1.15;
            includeInsulationCb.checked = false;
            includeWoodCb.checked = false;

            window.dormerConfig = [];
            window.wasteVisible = false;
            if (showWasteBtn) {
                showWasteBtn.classList.remove('active');
                showWasteBtn.style.backgroundColor = '';
            }

            await loadPrices();
            renderDormerUI();
            window.needs3DUpdate = true;
            recalculateNumbers();

            if (window.controls && window.camera) {
                const maxDim = Math.max(10, 8);
                const targetY = Math.tan(30 * Math.PI / 180) * 4;

                if (window.TWEEN) {
                    new TWEEN.Tween(window.camera.position)
                        .to({ x: maxDim * 1.5, y: maxDim * 0.8, z: maxDim * 1.5 }, 1200)
                        .easing(TWEEN.Easing.Cubic.Out)
                        .start();

                    new TWEEN.Tween(window.controls.target)
                        .to({ x: 0, y: targetY, z: 0 }, 1200)
                        .easing(TWEEN.Easing.Cubic.Out)
                        .onUpdate(() => window.controls.update())
                        .start();
                } else {
                    window.controls.target.set(0, targetY, 0);
                    window.camera.position.set(maxDim * 1.5, maxDim * 0.8, maxDim * 1.5);
                    window.controls.update();
                }
            }
        });
    }
}

function renderDormerUI() {
    const container = document.getElementById('dormersContainer');
    if (!container) return;

    container.innerHTML = '';
    window.dormerConfig.forEach((dormer, index) => {
        const el = document.createElement('div');
        el.className = 'dormer-item';

        const len = parseFloat(document.getElementById('length').value) || 10;
        const wid = parseFloat(document.getElementById('width').value) || 8;
        let maxPos;
        let maxWidth;
        if (dormer.side === 'front' || dormer.side === 'back') {
            maxWidth = wid;
            maxPos = Math.max(0, (wid / 2) - (dormer.width / 2));
        } else {
            maxWidth = len;
            maxPos = Math.max(0, (len / 2) - (dormer.width / 2));
        }

        const isHip = document.getElementById('roofShape').value === 'hip' || document.getElementById('roofShape').value === 'mansard';

        el.innerHTML = `
            <button class="btn-remove" onclick="removeDormer(${index})" title="Удалить">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--text-main);">Врезка #${index + 1}</div>
            
            <div class="form-group" style="margin-bottom:12px;">
                <label>Сторона крыши</label>
                <select class="custom-select" onchange="updateDormer(${index}, 'side', this.value)" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main);">
                    <option value="right" ${dormer.side === 'right' || !dormer.side ? 'selected' : ''}>Справа (+X)</option>
                    <option value="left" ${dormer.side === 'left' ? 'selected' : ''}>Слева (-X)</option>
                    ${isHip ? `<option value="front" ${dormer.side === 'front' ? 'selected' : ''}>Спереди (+Z)</option>` : ''}
                    ${isHip ? `<option value="back" ${dormer.side === 'back' ? 'selected' : ''}>Сзади (-Z)</option>` : ''}
                </select>
            </div>

            <div class="grid-2">
                <div class="form-group" style="margin-bottom:0;"><label>Ширина (м)</label><input type="number" step="0.5" min="1" max="${maxWidth}" value="${dormer.width}" onchange="updateDormer(${index}, 'width', this.value)"></div>
                <div class="form-group" style="margin-bottom:0;"><label>Вынос (м)</label><input type="number" step="0.5" min="0.5" max="10" value="${dormer.projection}" onchange="updateDormer(${index}, 'projection', this.value)"></div>
            </div>
            <div class="slider-group" style="margin-top:12px;">
                <label>По оси: <span style="color:var(--text-main); font-weight:500;">${dormer.position} м</span></label>
                <input class="custom-slider" type="range" min="-${maxPos}" max="${maxPos}" step="0.1" value="${dormer.position}" oninput="updateDormer(${index}, 'position', this.value)">
            </div>
        `;
        container.appendChild(el);
    });
}

window.updateDormer = (index, key, val) => {
    if (key === 'side') {
        window.dormerConfig[index][key] = val;
        window.validateDormers();
    } else {
        let numVal = parseFloat(val) || 0;
        if (key === 'width') {
            const len = parseFloat(document.getElementById('length').value) || 10;
            const wid = parseFloat(document.getElementById('width').value) || 8;
            const side = window.dormerConfig[index].side;
            const maxWidth = (side === 'front' || side === 'back') ? wid : len;
            numVal = Math.min(Math.max(1, numVal), maxWidth);
        } else if (key === 'projection') {
            numVal = Math.max(0.5, numVal);
        }
        window.dormerConfig[index][key] = numVal;
        window.validateDormers();
    }

    if (key !== 'position') renderDormerUI();
    else {
        const span = document.querySelector(`#dormersContainer .dormer-item:nth-child(${index + 1}) .slider-group span`);
        if (span) span.textContent = val + ' м';
    }
    window.needs3DUpdate = true;
    recalculateNumbers();
};

window.removeDormer = (index) => {
    window.dormerConfig.splice(index, 1);
    renderDormerUI();
    window.needs3DUpdate = true;
    recalculateNumbers();
};

let calcTimeout = null;
window.recalculateNumbers = function () {
    window.needsCalcUpdate = false;
    clearTimeout(calcTimeout);
    calcTimeout = setTimeout(_recalculateNumbers, 200);
};

async function _recalculateNumbers() {
    const payload = {
        length: parseFloat(document.getElementById('length').value) || 0,
        width: parseFloat(document.getElementById('width').value) || 0,
        angle: parseFloat(document.getElementById('angle').value) || 0,
        overhang: parseFloat(document.getElementById('overhang').value) || 0,
        roofShape: document.getElementById('roofShape').value,
        materialPrice: parseFloat(document.getElementById('material').value) || 0,
        wastePct: parseFloat(document.getElementById('waste').value) || 0,
        sheetWidth: parseFloat(document.getElementById('sheetWidth').value) || 1.15,
        laborRate: parseFloat(document.getElementById('labor').value) || 0,
        dormers: window.dormerConfig,
        includeInsulation: document.getElementById('includeInsulation').checked,
        includeWood: document.getElementById('includeWood').checked
    };

    const wastePctDisplay = document.getElementById('wastePctDisplay');
    if (wastePctDisplay) wastePctDisplay.textContent = payload.wastePct;

    try {
        if (!window.currentPrices) {
            console.warn("Prices not loaded yet, skipping calculation.");
            return;
        }

        const data = window.RoofCalcEngine.calculate(payload, window.currentPrices);

        document.getElementById('netAreaVal').textContent = `${data.netArea} м²`;
        document.getElementById('totalArea').textContent = `${data.totalArea} м²`;
        document.getElementById('ridgeLengthDisplay').textContent = `${data.ridgeLength} м`;

        document.getElementById('materialCost').textContent = `${data.materialCost.toLocaleString('ru-RU')} ₸`;
        document.getElementById('laborCost').textContent = `${data.laborCost.toLocaleString('ru-RU')} ₸`;
        const gtEl = document.getElementById('grandTotal');
        gtEl.textContent = data.grandTotal.toLocaleString('ru-RU');
        gtEl.classList.remove('price-update-anim');
        void gtEl.offsetWidth; // trigger reflow
        gtEl.classList.add('price-update-anim');

        if (data.detailedMaterials) {
            document.getElementById('detCoverCost').textContent = `${data.detailedMaterials.mainCoverCost.toLocaleString('ru-RU')} ₸`;
            document.getElementById('detScrewsCount').textContent = data.detailedMaterials.screws.count.toLocaleString('ru-RU');
            document.getElementById('detScrewsCost').textContent = `${data.detailedMaterials.screws.cost.toLocaleString('ru-RU')} ₸`;
            document.getElementById('detMemArea').textContent = data.detailedMaterials.membrane.area;
            document.getElementById('detMemCost').textContent = `${data.detailedMaterials.membrane.cost.toLocaleString('ru-RU')} ₸`;

            const insRow = document.getElementById('detInsulationRow');
            if (data.detailedMaterials.insulation.volume > 0) {
                insRow.style.display = 'flex';
                document.getElementById('detInsVolume').textContent = data.detailedMaterials.insulation.volume;
                document.getElementById('detInsCost').textContent = `${data.detailedMaterials.insulation.cost.toLocaleString('ru-RU')} ₸`;
            } else {
                insRow.style.display = 'none';
            }

            const woodRow = document.getElementById('detWoodRow');
            if (data.detailedMaterials.wood.volume > 0) {
                woodRow.style.display = 'flex';
                document.getElementById('detWoodVolume').textContent = data.detailedMaterials.wood.volume;
                document.getElementById('detWoodCost').textContent = `${data.detailedMaterials.wood.cost.toLocaleString('ru-RU')} ₸`;
            } else {
                woodRow.style.display = 'none';
            }
        }
    } catch (e) {
        console.error("Calculation failed:", e);
        document.getElementById('netAreaVal').textContent = 'Ошибка';
        document.getElementById('totalArea').textContent = 'Ошибка';
        document.getElementById('materialCost').textContent = 'Ошибка';
        document.getElementById('laborCost').textContent = 'Ошибка';
        document.getElementById('grandTotal').textContent = 'Ошибка';
    }
}


function downloadPdfEstimate() {
    if (typeof html2pdf === 'undefined') {
        alert('Библиотека для создания PDF еще загружается. Попробуйте через секунду.');
        return;
    }

    const btn = document.getElementById('downloadPdfBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Формирование...';
    btn.disabled = true;

    const roofShapeEl = document.getElementById('roofShape');
    const shapeMap = {
        'gable': 'Двускатная',
        'hip': 'Вальмовая',
        'flat': 'Плоская',
        'shed': 'Односкатная',
        'mansard': 'Мансардная'
    };
    const roofShapeText = shapeMap[roofShapeEl.value] || roofShapeEl.value;

    const materialPrice = parseFloat(document.getElementById('material').value);
    let materialText = 'Покрытие крыши';
    if (window.currentPrices && window.currentPrices.materials) {
        const mat = window.currentPrices.materials.find(m => m.price == materialPrice);
        if (mat) materialText = mat.name;
    }
    let snapshotHtml = '';
    if (window.renderer && window.scene && window.camera) {
        window.renderer.render(window.scene, window.camera);
        const dataUrl = window.renderer.domElement.toDataURL('image/jpeg', 0.95);
        snapshotHtml = `
            <div style="margin-bottom: 20px; text-align: center;">
                <img src="${dataUrl}" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 1px solid #e2e8f0; object-fit: contain;">
            </div>
        `;
    }

    const html = `
        <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #1e293b; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
                <div>
                    <h1 style="font-size: 28px; margin: 0; color: #0ea5e9;">RoofCalc PRO</h1>
                    <p style="color: #64748b; margin: 5px 0 0 0;">Детализированная смета на устройство кровли</p>
                </div>
                <div style="text-align: right; color: #64748b; font-size: 14px;">
                    Дата: ${new Date().toLocaleDateString('ru-RU')}<br>
                    ID: ${Math.floor(Math.random() * 1000000)}
                </div>
            </div>
            
            ${snapshotHtml}
            
            <h3 style="font-size: 18px; margin-top: 0; margin-bottom: 15px;">Параметры крыши</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600; width: 40%;">Конфигурация</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${roofShapeText}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;">Материал покрытия</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${materialText}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;">Полезная площадь</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${document.getElementById('netAreaVal').innerText}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;">Общая площадь (с учетом отходов)</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">${document.getElementById('totalArea').innerText}</td>
                </tr>
            </table>

            <h3 style="margin-top: 30px; font-size: 18px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1;">Финансовый расчет</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="background: #f8fafc;">
                    <th style="padding: 12px; text-align: left; border: 1px solid #e2e8f0;">Наименование</th>
                    <th style="padding: 12px; text-align: right; border: 1px solid #e2e8f0;">Сумма (₸)</th>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e2e8f0;">Основное покрытие</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0;">${document.getElementById('detCoverCost').innerText}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e2e8f0;">Крепеж</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0;">${document.getElementById('detScrewsCost').innerText}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e2e8f0;">Пленки и мембраны</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0;">${document.getElementById('detMemCost').innerText}</td>
                </tr>
                ${document.getElementById('detInsulationRow').style.display !== 'none' ? `
                <tr>
                    <td style="padding: 12px; border: 1px solid #e2e8f0;">Утеплитель</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0;">${document.getElementById('detInsCost').innerText}</td>
                </tr>` : ''}
                ${document.getElementById('detWoodRow').style.display !== 'none' ? `
                <tr>
                    <td style="padding: 12px; border: 1px solid #e2e8f0;">Пиломатериалы (стропила, обрешетка)</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0;">${document.getElementById('detWoodCost').innerText}</td>
                </tr>` : ''}
                <tr>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Работа по монтажу</td>
                    <td style="padding: 12px; text-align: right; border: 1px solid #e2e8f0; font-weight: 600;">${document.getElementById('laborCost').innerText}</td>
                </tr>
            </table>

            <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; text-align: right; font-size: 22px; font-weight: bold; color: #0f172a; border: 1px solid #e2e8f0;">
                Итого к оплате: <span style="color: #0ea5e9;">${document.getElementById('grandTotal').innerText}</span>
            </div>

            <div style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center;">
                Смета сгенерирована автоматически на сайте ${window.location.hostname || 'RoofCalc PRO'}<br>
                Данный расчет является предварительным и может потребовать уточнения.
            </div>
        </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = html;
    
    const opt = {
        margin:       0,
        filename:     'RoofCalc_Smeta.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }).catch(err => {
        console.error(err);
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert("Произошла ошибка при создании PDF.");
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('downloadPdfBtn');
    if (btn) btn.addEventListener('click', downloadPdfEstimate);
});

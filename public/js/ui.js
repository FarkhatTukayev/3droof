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
        const res = await fetch('/prices.json');
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

    window.validateDormers = function() {
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
        document.getElementById('grandTotal').textContent = data.grandTotal.toLocaleString('ru-RU');

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

window.RoofCalcEngine = {
    calculate: function(payload, prices) {
        const {
            length = 0,
            width = 0,
            angle = 0,
            materialPrice = 0,
            wastePct = 0,
            sheetWidth = 1.15,
            laborRate = 0,
            dormers = [],
            roofShape = 'gable',
            overhang = 0.5,
            includeInsulation = false,
            includeWood = false
        } = payload;

        const rad = angle * Math.PI / 180;
        const realLength = length + (2 * overhang);
        const realWidth = width + (2 * overhang);
        const baseArea = realLength * realWidth;

        let netArea = 0;
        let grossArea = 0;
        let ridgeLength = 0;

        const effLength = Math.ceil(realLength / sheetWidth) * sheetWidth;
        const effWidth = Math.ceil(realWidth / sheetWidth) * sheetWidth;

        if (roofShape === 'flat') {
            netArea = baseArea * 1.05;
            grossArea = (effLength * effWidth) * 1.05;
            ridgeLength = 0;
        } else if (roofShape === 'mansard') {
            const lowerPitch = Math.max(45, angle) * Math.PI / 180;
            const upperPitch = 15 * Math.PI / 180;
            let h1 = 2.5;
            let inset1 = h1 / Math.tan(lowerPitch);
            if (inset1 > Math.min(realWidth, realLength) / 2.5) {
                inset1 = Math.min(realWidth, realLength) / 2.5;
            }
            const outerArea = baseArea;
            const innerWidth = Math.max(0, realWidth - 2 * inset1);
            const innerLength = Math.max(0, realLength - 2 * inset1);
            const innerArea = innerWidth * innerLength;
            
            const lowerRingArea = outerArea - innerArea;
            const areaLower = lowerRingArea / Math.cos(lowerPitch);
            const areaUpper = innerArea / Math.cos(upperPitch);
            
            netArea = areaLower + areaUpper;
            grossArea = netArea * (effLength / realLength);
            ridgeLength = Math.max(0, realLength - realWidth);
        } else if (roofShape === 'hip') {
            netArea = baseArea / Math.cos(rad);
            grossArea = (effLength * effWidth) / Math.cos(rad);
            ridgeLength = Math.max(0, realLength - realWidth);
        } else if (roofShape === 'shed') {
            netArea = baseArea / Math.cos(rad);
            grossArea = (effLength * realWidth) / Math.cos(rad);
            ridgeLength = 0;
        } else {
            // gable
            netArea = baseArea / Math.cos(rad);
            grossArea = (effLength * realWidth) / Math.cos(rad);
            ridgeLength = realLength;
        }

        // Обработка врезок
        if ((roofShape === 'gable' || roofShape === 'hip') && Array.isArray(dormers)) {
            dormers.forEach(d => {
                const dWidth = parseFloat(d.width) || 0;
                const dProj = parseFloat(d.projection) || 0;
                const dSlopeLen = (dWidth / 2) / Math.cos(rad);
                
                // Добавляем площадь самой врезки (только наружная часть, которая торчит)
                const dormerArea = dSlopeLen * dProj * 2;
                netArea += dormerArea;
                
                // Вычитаем дырку в основной крыше (площадь под врезкой)
                // Проекция дырки на скат - это треугольник с основанием dWidth и высотой dSlopeLen
                const holeArea = (dWidth * dSlopeLen) / 2;
                netArea -= holeArea;
                
                const dEffWidth = Math.ceil(dProj * 2 / sheetWidth) * sheetWidth;
                grossArea += (dSlopeLen * dEffWidth);
                // Уменьшаем черновую площадь на дырку, чтобы цена была справедливой
                grossArea -= holeArea;
            });
        }

        // Итоговая закупка с учетом запаса
        const totalArea = grossArea * (1 + wastePct / 100);

        const ridgePrice = prices.accessories.ridgePrice;
        const additionalCosts = ridgeLength * ridgePrice;

        const requiredScrews = Math.ceil(totalArea * prices.accessories.screwsPerSqM);
        const packsCount = Math.ceil(requiredScrews / prices.accessories.screwsPerPack);
        const screwsCount = packsCount * prices.accessories.screwsPerPack;
        const screwsCost = screwsCount * prices.accessories.screwPrice;

        const membraneArea = Math.ceil(netArea * 1.15);
        const membraneCost = membraneArea * (prices.accessories.membraneHydro + prices.accessories.membraneVapor);

        let insulationVolume = 0;
        let insulationCost = 0;
        if (includeInsulation) {
            insulationVolume = Math.ceil(netArea * 0.2 * 10) / 10;
            insulationCost = Math.round(insulationVolume * prices.accessories.insulationPrice);
        }

        let woodVolume = 0;
        let woodCost = 0;
        if (includeWood) {
            woodVolume = Math.ceil(netArea * 0.03 * 100) / 100;
            woodCost = Math.round(woodVolume * prices.accessories.woodPrice);
        }

        const materialCost = (totalArea * materialPrice) + additionalCosts + screwsCost + membraneCost + insulationCost + woodCost;
        const laborCost = totalArea * laborRate;
        const grandTotal = materialCost + laborCost;

        const detailedMaterials = {
            mainCoverCost: Math.round((totalArea * materialPrice) + additionalCosts),
            screws: { count: screwsCount, cost: screwsCost },
            membrane: { area: membraneArea, cost: membraneCost },
            insulation: { volume: insulationVolume, cost: insulationCost },
            wood: { volume: woodVolume, cost: woodCost }
        };

        return {
            netArea: Math.round(netArea * 100) / 100,
            totalArea: Math.round(totalArea * 100) / 100,
            ridgeLength: Math.round(ridgeLength * 100) / 100,
            materialCost: Math.round(materialCost),
            laborCost: Math.round(laborCost),
            grandTotal: Math.round(grandTotal),
            detailedMaterials
        };
    }
};

const scene = new THREE.Scene();
window.scene = scene;
let camera, renderer, labelRenderer, controls;
let roofMeshes = [];
let labelMeshes = [];
let dragControls;
window.resizeHandles = [];
window.activeDragHandle = null;
const textureCache = {};
function getBumpMap(type) {
    if (textureCache[type]) return textureCache[type];
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (type === 'metal-tile') {
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 64) {
            const grad = ctx.createLinearGradient(0, y, 0, y + 64);
            grad.addColorStop(0, '#aaa');
            grad.addColorStop(0.8, '#777');
            grad.addColorStop(1, '#222');
            ctx.fillStyle = grad;
            ctx.fillRect(0, y, 512, 64);
        }
        ctx.globalCompositeOperation = 'overlay';
        for (let x = 0; x < 512; x += 64) {
            const waveGrad = ctx.createLinearGradient(x, 0, x + 64, 0);
            waveGrad.addColorStop(0, '#666');
            waveGrad.addColorStop(0.5, '#ddd');
            waveGrad.addColorStop(1, '#666');
            ctx.fillStyle = waveGrad;
            ctx.fillRect(x, 0, 64, 512);
        }
    } else if (type === 'corrugated') {
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 0, 512, 512);
        for (let x = 0; x < 512; x += 32) {
            const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
            grad.addColorStop(0, '#222');
            grad.addColorStop(0.2, '#aaa');
            grad.addColorStop(0.8, '#aaa');
            grad.addColorStop(1, '#222');
            ctx.fillStyle = grad;
            ctx.fillRect(x, 0, 32, 512);
        }
    } else if (type === 'bitumen') {
        ctx.fillStyle = '#666';
        ctx.fillRect(0, 0, 512, 512);
        const imgData = ctx.getImageData(0, 0, 512, 512);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const noise = Math.random() * 80 - 40;
            imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
            imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + noise));
            imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 6;
        let row = 0;
        for (let y = 0; y < 512; y += 48) {
            let offset = (row % 2) * 48;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(512, y);
            ctx.stroke();
            for (let x = -offset; x < 512; x += 96) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + 48);
                ctx.stroke();
            }
            row++;
        }
    } else {
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 0, 512, 512);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    textureCache[type] = tex;
    return tex;
}
window.init3D = function () {
    const container = document.getElementById('canvas-container');
    camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 1000);
    window.camera = camera;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    container.appendChild(renderer.domElement);
    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    window.controls = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 150;
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(20, 40, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.5);
    fillLight.position.set(-20, 20, -20);
    scene.add(fillLight);
    const gridHelper = new THREE.GridHelper(80, 80, 0x94a3b8, 0xe2e8f0);
    gridHelper.material.opacity = 0.5;
    gridHelper.material.transparent = true;
    gridHelper.position.y = -2.51;
    scene.add(gridHelper);
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.05 });
    const groundObj = new THREE.Mesh(groundGeo, groundMat);
    groundObj.rotation.x = -Math.PI / 2;
    groundObj.position.y = -2.51;
    groundObj.receiveShadow = true;
    scene.add(groundObj);
    const handleGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3, metalness: 0.1 });
    const handleZPos = new THREE.Mesh(handleGeo, handleMat.clone()); handleZPos.userData = { axis: 'z', sign: 1 };
    const handleZNeg = new THREE.Mesh(handleGeo, handleMat.clone()); handleZNeg.userData = { axis: 'z', sign: -1 };
    const handleXPos = new THREE.Mesh(handleGeo, handleMat.clone()); handleXPos.userData = { axis: 'x', sign: 1 };
    const handleXNeg = new THREE.Mesh(handleGeo, handleMat.clone()); handleXNeg.userData = { axis: 'x', sign: -1 };
    window.resizeHandles = [handleZPos, handleZNeg, handleXPos, handleXNeg];
    window.resizeHandles.forEach(h => {
        h.castShadow = true;
        scene.add(h);
    });
    if (THREE.DragControls) {
        dragControls = new THREE.DragControls(window.resizeHandles, camera, renderer.domElement);
        dragControls.addEventListener('dragstart', function (event) {
            if (controls) controls.enabled = false;
            window.activeDragHandle = event.object;
            event.object.material.emissive.setHex(0x3b82f6);
            event.object.material.emissiveIntensity = 0.5;
            document.body.style.cursor = 'grabbing';
        });
        dragControls.addEventListener('dragend', function (event) {
            if (controls) controls.enabled = true;
            window.activeDragHandle = null;
            event.object.material.emissive.setHex(0x000000);
            document.body.style.cursor = 'auto';
            window.needs3DUpdate = true;
            if (typeof recalculateNumbers === 'function') recalculateNumbers();
        });
        dragControls.addEventListener('drag', function (event) {
            const obj = event.object;
            if (obj.userData.axis === 'x') {
                obj.position.y = 0;
                obj.position.z = 0;
                let newWidth = obj.position.x * obj.userData.sign * 2;
                newWidth = Math.max(2, Math.min(50, newWidth));
                newWidth = Math.round(newWidth * 2) / 2;
                const wInp = document.getElementById('width');
                if (parseFloat(wInp.value) !== newWidth) {
                    wInp.value = newWidth;
                    wInp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (obj.userData.axis === 'z') {
                obj.position.x = 0;
                obj.position.y = 0;
                let newLength = obj.position.z * obj.userData.sign * 2;
                newLength = Math.max(2, Math.min(50, newLength));
                newLength = Math.round(newLength * 2) / 2;
                const lInp = document.getElementById('length');
                if (parseFloat(lInp.value) !== newLength) {
                    lInp.value = newLength;
                    lInp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
        dragControls.addEventListener('hoveron', function () {
            document.body.style.cursor = 'grab';
        });
        dragControls.addEventListener('hoveroff', function () {
            document.body.style.cursor = 'auto';
        });
    }
    animate();
    window.addEventListener('resize', onWindowResize);
};
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    if (container && container.clientWidth && container.clientHeight) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        labelRenderer.setSize(container.clientWidth, container.clientHeight);
    }
}
function createGableShape(w, h) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(w / 2, h);
    shape.lineTo(w, 0);
    shape.lineTo(0, 0);
    return shape;
}
function createRoofMesh(shape, depth, colorHex, matType) {
    const extrudeSettings = { depth: depth, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.computeBoundingBox();
    const bBox = geometry.boundingBox;
    geometry.translate(
        -(bBox.max.x - bBox.min.x) / 2,
        0,
        -(bBox.max.z - bBox.min.z) / 2
    );
    const baseTex = getBumpMap(matType || 'metal-tile');
    const bumpTexture = baseTex.clone();
    bumpTexture.needsUpdate = true;
    bumpTexture.repeat.set(0.5, 0.5);
    const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: matType === 'metal-tile' || matType === 'corrugated' ? 0.6 : 0.9,
        metalness: matType === 'metal-tile' ? 0.3 : (matType === 'corrugated' ? 0.4 : 0.05),
        bumpMap: bumpTexture,
        bumpScale: 0.05,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.15, transparent: true }));
    mesh.add(line);
    return mesh;
}
window.build3DModel = function () {
    if (!window.needs3DUpdate) return;
    window.needs3DUpdate = false;
    const lengthInput = document.getElementById('length');
    const widthInput = document.getElementById('width');
    const overhangInput = document.getElementById('overhang');
    const angleInput = document.getElementById('angle');
    const baseLen = parseFloat(lengthInput ? lengthInput.value : 10) || 10;
    const baseWid = parseFloat(widthInput ? widthInput.value : 8) || 8;
    const overhang = parseFloat(overhangInput ? overhangInput.value : 0.5) || 0;
    const len = baseLen + (2 * overhang);
    const wid = baseWid + (2 * overhang);
    const angleDeg = parseFloat(angleInput ? angleInput.value : 30) || 30;
    roofMeshes.forEach(m => scene.remove(m));
    roofMeshes = [];
    labelMeshes.forEach(m => scene.remove(m));
    labelMeshes = [];
    const matId = document.getElementById('material').value;
    let matType = 'metal-tile';
    if (matId == 2500) matType = 'corrugated';
    else if (matId == 4500) matType = 'bitumen';
    let roofColor = 0x1e293b;
    if (window.materialColorMap && window.materialColorMap[matId]) {
        roofColor = window.materialColorMap[matId];
    } else {
        roofColor = 0x334155;
    }
    const height = Math.tan(angleDeg * Math.PI / 180) * (wid / 2);
    const shapeType = document.getElementById('roofShape').value;
    let mainRoofGeo;
    const extrudeSettings = { depth: len, bevelEnabled: false };
    if (shapeType === 'gable') {
        const shape = createGableShape(wid, height);
        mainRoofGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        mainRoofGeo.translate(-wid / 2, 0, -len / 2);
    } else if (shapeType === 'shed') {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0, height * 2);
        shape.lineTo(wid, 0);
        shape.lineTo(0, 0);
        mainRoofGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        mainRoofGeo.translate(-wid / 2, 0, -len / 2);
    } else if (shapeType === 'flat') {
        mainRoofGeo = new THREE.BoxGeometry(wid, 0.4, len);
        mainRoofGeo.translate(0, 0.2, 0);
    } else {
        const geom = new THREE.BufferGeometry();
        let inset1, h1, inset2, h2;
        if (shapeType === 'hip') {
            inset1 = Math.min(wid, len) / 2;
            h1 = inset1 * Math.tan(angleDeg * Math.PI / 180);
            inset2 = inset1;
            h2 = h1;
        } else {
            const lowerPitch = Math.max(45, angleDeg);
            const upperPitch = 15;
            h1 = 2.5;
            inset1 = h1 / Math.tan(lowerPitch * Math.PI / 180);
            if (inset1 > Math.min(wid, len) / 2.5) {
                inset1 = Math.min(wid, len) / 2.5;
                h1 = inset1 * Math.tan(lowerPitch * Math.PI / 180);
            }
            inset2 = Math.min(wid, len) / 2;
            h2 = h1 + (inset2 - inset1) * Math.tan(upperPitch * Math.PI / 180);
        }
        const w2 = wid / 2; const l2 = len / 2;
        const v = new Float32Array([
            -w2, 0, -l2, w2, 0, -l2, w2, 0, l2, -w2, 0, l2,
            -w2 + inset1, h1, -l2 + inset1, w2 - inset1, h1, -l2 + inset1, w2 - inset1, h1, l2 - inset1, -w2 + inset1, h1, l2 - inset1,
            -w2 + inset2, h2, -l2 + inset2, w2 - inset2, h2, -l2 + inset2, w2 - inset2, h2, l2 - inset2, -w2 + inset2, h2, l2 - inset2,
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(v, 3));
        const uvs = new Float32Array((v.length / 3) * 2);
        for (let i = 0; i < v.length / 3; i++) {
            uvs[i * 2] = v[i * 3];
            uvs[i * 2 + 1] = v[i * 3 + 2];
        }
        geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        let indices = [
            0, 5, 1, 0, 4, 5,
            1, 6, 2, 1, 5, 6,
            2, 7, 3, 2, 6, 7,
            3, 4, 0, 3, 7, 4
        ];
        if (shapeType === 'mansard') {
            indices.push(
                4, 9, 5, 4, 8, 9,
                5, 10, 6, 5, 9, 10,
                6, 11, 7, 6, 10, 11,
                7, 8, 4, 7, 11, 8,
                8, 10, 9, 8, 11, 10
            );
        } else {
            indices.push(4, 6, 5, 4, 7, 6);
        }
        geom.setIndex(indices);
        geom.computeVertexNormals();
        mainRoofGeo = geom;
    }
    const baseTex = getBumpMap(matType);
    const bumpTexture = baseTex.clone();
    bumpTexture.needsUpdate = true;
    bumpTexture.repeat.set(0.5, 0.5);
    const material = new THREE.MeshStandardMaterial({
        color: roofColor,
        roughness: matType === 'metal-tile' || matType === 'corrugated' ? 0.6 : 0.9,
        metalness: matType === 'metal-tile' ? 0.3 : (matType === 'corrugated' ? 0.4 : 0.05),
        bumpMap: bumpTexture,
        bumpScale: 0.05,
        side: THREE.DoubleSide
    });
    const mainRoof = new THREE.Mesh(mainRoofGeo, material);
    mainRoof.castShadow = true;
    mainRoof.receiveShadow = true;
    const edges = new THREE.EdgesGeometry(mainRoofGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.15, transparent: true }));
    mainRoof.add(line);
    scene.add(mainRoof);
    roofMeshes.push(mainRoof);
    const baseGeo = new THREE.BoxGeometry(baseWid, 5, baseLen);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 1.0 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -2.5, 0);
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    scene.add(baseMesh);
    roofMeshes.push(baseMesh);
    const lengthDiv = document.createElement('div');
    lengthDiv.className = 'dimension-badge';
    lengthDiv.title = 'Кликните для редактирования длины';
    lengthDiv.textContent = `${baseLen} м`;
    lengthDiv.onclick = () => {
        const inp = document.getElementById('length');
        if (inp) {
            inp.focus();
            inp.classList.add('flash-highlight');
            setTimeout(() => inp.classList.remove('flash-highlight'), 1000);
        }
    };
    const lengthLabel = new THREE.CSS2DObject(lengthDiv);
    lengthLabel.position.set(baseWid / 2 + 0.1, -2.5, 0);
    scene.add(lengthLabel);
    labelMeshes.push(lengthLabel);
    const widthDiv = document.createElement('div');
    widthDiv.className = 'dimension-badge';
    widthDiv.title = 'Кликните для редактирования ширины';
    widthDiv.textContent = `${baseWid} м`;
    widthDiv.onclick = () => {
        const inp = document.getElementById('width');
        if (inp) {
            inp.focus();
            inp.classList.add('flash-highlight');
            setTimeout(() => inp.classList.remove('flash-highlight'), 1000);
        }
    };
    const widthLabel = new THREE.CSS2DObject(widthDiv);
    widthLabel.position.set(0, -2.5, baseLen / 2 + 0.1);
    scene.add(widthLabel);
    labelMeshes.push(widthLabel);
    const canHaveDormers = (shapeType === 'gable' || shapeType === 'hip');
    if (canHaveDormers && window.dormerConfig) {
        window.dormerConfig.forEach((dormer) => {
            const dHeight = Math.tan(angleDeg * Math.PI / 180) * (dormer.width / 2);
            const dShape = createGableShape(dormer.width, dHeight);
            
            let dExtrusion, rotY, posX, posZ_val;
            let bPosX, bPosZ, dBaseGeo;
            
            let dBaseLen = dormer.projection + overhang;
            if (dormer.side === 'left') {
                dExtrusion = dormer.projection + (wid / 2);
                rotY = -Math.PI / 2;
                posX = -dExtrusion / 2;
                posZ_val = dormer.position;
                dBaseGeo = new THREE.BoxGeometry(dBaseLen, 5, dormer.width - 0.4);
                bPosX = -baseWid / 2 - dBaseLen / 2;
                bPosZ = posZ_val;
            } else if (dormer.side === 'front') {
                dExtrusion = dormer.projection + (len / 2);
                rotY = 0;
                posX = dormer.position;
                posZ_val = dExtrusion / 2;
                dBaseGeo = new THREE.BoxGeometry(dormer.width - 0.4, 5, dBaseLen);
                bPosX = posX;
                bPosZ = baseLen / 2 + dBaseLen / 2;
            } else if (dormer.side === 'back') {
                dExtrusion = dormer.projection + (len / 2);
                rotY = Math.PI;
                posX = dormer.position;
                posZ_val = -dExtrusion / 2;
                dBaseGeo = new THREE.BoxGeometry(dormer.width - 0.4, 5, dBaseLen);
                bPosX = posX;
                bPosZ = -baseLen / 2 - dBaseLen / 2;
            } else { // right
                dExtrusion = dormer.projection + (wid / 2);
                rotY = Math.PI / 2;
                posX = dExtrusion / 2;
                posZ_val = dormer.position;
                dBaseGeo = new THREE.BoxGeometry(dBaseLen, 5, dormer.width - 0.4);
                bPosX = baseWid / 2 + dBaseLen / 2;
                bPosZ = posZ_val;
            }
            
            const dRoof = createRoofMesh(dShape, dExtrusion, roofColor, matType);
            dRoof.rotation.y = rotY;
            dRoof.position.set(posX, 0, posZ_val);
            scene.add(dRoof);
            roofMeshes.push(dRoof);
            
            const dBaseMesh = new THREE.Mesh(dBaseGeo, baseMat);
            dBaseMesh.position.set(bPosX, -2.5, bPosZ);
            dBaseMesh.receiveShadow = true;
            dBaseMesh.castShadow = true;
            scene.add(dBaseMesh);
            roofMeshes.push(dBaseMesh);
        });
    }
    window.wasteGroupMeshes = [];
    if (window.wasteVisible) {
        const wasteVal = parseFloat(document.getElementById('waste').value) || 0;
        if (wasteVal > 0) {
            let scaleMult = Math.sqrt(1 + wasteVal / 100);
            if (scaleMult < 1.01) scaleMult = 1.01;
            
            const wasteMeshes = [];
            roofMeshes.forEach(mesh => {
                if (mesh.material && mesh.material.color && mesh.material.color.getHex() !== 0xf8fafc) {
                    const wasteGeo = mesh.geometry.clone();
                    
                    const wasteMat = new THREE.MeshStandardMaterial({
                        color: 0xff3b30,
                        transparent: true,
                        opacity: 0.25,
                        side: THREE.DoubleSide,
                        depthWrite: false,
                        roughness: 0.1,
                        metalness: 0.5,
                        emissive: 0xff3b30,
                        emissiveIntensity: 0.4
                    });
                    
                    const wMesh = new THREE.Mesh(wasteGeo, wasteMat);
                    wMesh.position.copy(mesh.position);
                    wMesh.rotation.copy(mesh.rotation);
                    
                    wMesh.userData = { baseScale: scaleMult };
                    wMesh.scale.set(scaleMult, scaleMult, scaleMult);
                    wMesh.position.y += 0.03;
                    
                    scene.add(wMesh);
                    wasteMeshes.push(wMesh);
                    window.wasteGroupMeshes.push(wMesh);

                    const edges = new THREE.EdgesGeometry(wasteGeo);
                    const lineMat = new THREE.LineBasicMaterial({ 
                        color: 0xff3b30, 
                        opacity: 0.7, 
                        transparent: true 
                    });
                    const line = new THREE.LineSegments(edges, lineMat);
                    wMesh.add(line);
                    wasteMeshes.push(line);
                }
            });
            roofMeshes = roofMeshes.concat(wasteMeshes);
        }
    }

    const maxDim = Math.max(len, wid);
    controls.target.set(0, height / 2, 0);
    if (!window.cameraInitialized) {
        camera.position.set(maxDim * 1.5, maxDim * 0.8, maxDim * 1.5);
        window.cameraInitialized = true;
    }
    if (window.resizeHandles && window.resizeHandles.length === 4) {
        if (window.activeDragHandle !== window.resizeHandles[0]) window.resizeHandles[0].position.set(0, 0, baseLen / 2);
        if (window.activeDragHandle !== window.resizeHandles[1]) window.resizeHandles[1].position.set(0, 0, -baseLen / 2);
        if (window.activeDragHandle !== window.resizeHandles[2]) window.resizeHandles[2].position.set(baseWid / 2, 0, 0);
        if (window.activeDragHandle !== window.resizeHandles[3]) window.resizeHandles[3].position.set(-baseWid / 2, 0, 0);
    }
}
let lastCamPos = new THREE.Vector3();
let lastCamRot = new THREE.Euler();
window.needsRender = true;

function animate(time) {
    requestAnimationFrame(animate);
    
    if (window.TWEEN) {
        TWEEN.update(time);
    }

    if (controls) controls.update();
    
    if (window.needs3DUpdate && typeof window.build3DModel === 'function') {
        window.build3DModel();
        window.needsRender = true;
    }
    
    let isPulsing = false;
    if (window.wasteVisible && window.wasteGroupMeshes && window.wasteGroupMeshes.length > 0) {
        const pulseTime = Date.now() * 0.003;
        const pulse = 1 + Math.sin(pulseTime) * 0.015;
        window.wasteGroupMeshes.forEach(m => {
            if (m.userData && m.userData.baseScale) {
                const s = m.userData.baseScale * pulse;
                m.scale.set(s, s, s);
            }
        });
        isPulsing = true;
    }
    
    let camChanged = !camera.position.equals(lastCamPos) || !camera.rotation.equals(lastCamRot);
    if (camChanged) {
        lastCamPos.copy(camera.position);
        lastCamRot.copy(camera.rotation);
    }

    const hasActiveTweens = window.TWEEN && TWEEN.getAll().length > 0;

    if (camChanged || isPulsing || window.needsRender || hasActiveTweens) {
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
            if (labelRenderer) labelRenderer.render(scene, camera);
        }
        window.needsRender = false;
    }
}

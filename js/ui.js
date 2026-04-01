window.dormerConfig = [];
window.needs3DUpdate = true;
window.needsCalcUpdate = true;
window.materialColorMap = {};
window.cameraInitialized = false;
window.wasteVisible = false;

document.addEventListener('DOMContentLoaded', async () => {
    await loadPrices();
    if (typeof init3D === 'function') {
        init3D();
    }
    setupEventListeners();
    recalculateNumbers();
});

async function loadPrices() {
    try {
        const res = await fetch('http://localhost:3000/api/prices');
        const data = await res.json();

        const matContainer = document.getElementById('materialSwatchesContainer');
        const matInput = document.getElementById('material');
        const colorMap = {};

        if (matContainer) {
            matContainer.innerHTML = '';
            data.materials.forEach(m => {
                const swatch = document.createElement('div');
                swatch.className = 'swatch';
                if (m.selected) {
                    swatch.classList.add('selected');
                    matInput.value = m.price;
                }
                let colorHex = '#334155';
                if (m.color !== undefined) {
                    let parsedColor = typeof m.color === 'string' ? parseInt(m.color, 16) : m.color;
                    colorHex = '#' + parsedColor.toString(16).padStart(6, '0');
                }
                swatch.style.backgroundColor = colorHex;
                swatch.setAttribute('data-tooltip', `${m.name} - ${m.price.toLocaleString('ru-RU')} ₸/м²`);

                const icons = {
                    'metal_econom': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M2 14l5-5 5 5 5-5 5 5"/><path d="M2 20l5-5 5 5 5-5 5 5"/></svg>',
                    'metal_premium': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M2 10l5-5 5 5 5-5 5 5"/><path d="M2 16l5-5 5 5 5-5 5 5"/><path d="M2 22l5-5 5 5 5-5 5 5"/></svg>',
                    'prof': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M4 4v16M8 4v16M12 4v16M16 4v16M20 4v16"/></svg>',
                    'soft': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="3" y="4" width="8" height="6" rx="1"/><rect x="13" y="4" width="8" height="6" rx="1"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>',
                    'comp': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>'
                };

                swatch.innerHTML = icons[m.id] || '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/></svg>';

                swatch.onclick = () => {
                    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
                    swatch.classList.add('selected');
                    matInput.value = m.price;
                    window.needs3DUpdate = true;
                    window.needsCalcUpdate = true;
                    recalculateNumbers();
                };
                matContainer.appendChild(swatch);
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

                    dormerSection.style.display = (roofShapeInput.value === 'gable' || roofShapeInput.value === 'hip') ? 'block' : 'none';
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

    [lengthInput, widthInput].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => {
            window.needs3DUpdate = true;
            renderDormerUI();
            recalculateNumbers();
        });
    });

    if (addDormerBtn) {
        addDormerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('dormerSection').open = true;
            window.dormerConfig.push({ width: 3, projection: 1.5, position: 0 });
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
                window.controls.target.set(0, (Math.tan(30 * Math.PI / 180) * 4), 0);
                window.camera.position.set(maxDim * 1.5, maxDim * 0.8, maxDim * 1.5);
                window.controls.update();
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
        const maxPos = Math.max(0, (len / 2) - (dormer.width / 2));

        el.innerHTML = `
            <button class="btn-remove" onclick="removeDormer(${index})" title="Удалить">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--text-main);">Врезка #${index + 1}</div>
            <div class="grid-2">
                <div class="form-group" style="margin-bottom:0;"><label>Ширина (м)</label><input type="number" step="0.5" min="1" max="10" value="${dormer.width}" oninput="updateDormer(${index}, 'width', this.value)"></div>
                <div class="form-group" style="margin-bottom:0;"><label>Вынос (м)</label><input type="number" step="0.5" min="0.5" max="10" value="${dormer.projection}" oninput="updateDormer(${index}, 'projection', this.value)"></div>
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
    window.dormerConfig[index][key] = parseFloat(val);
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
        const res = await fetch('http://localhost:3000/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("API Network Error");

        const data = await res.json();

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
        console.error("Calculation fetch failed:", e);
        document.getElementById('netAreaVal').textContent = 'Ошибка';
        document.getElementById('totalArea').textContent = 'Ошибка';
        document.getElementById('materialCost').textContent = 'Ошибка';
        document.getElementById('laborCost').textContent = 'Ошибка';
        document.getElementById('grandTotal').textContent = 'Ошибка';
    }
}

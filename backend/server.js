const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/calculate', (req, res) => {
    const {
        length = 0,
        width = 0,
        angle = 0,
        materialPrice = 0,
        wastePct = 0,
        laborRate = 0,
        dormers = [],
        roofShape = 'gable'
    } = req.body;

    const rad = angle * Math.PI / 180;

    let netArea = 0;

    // Точные математические формулы для каждого типа крыши
    if (roofShape === 'flat') {
        // Плоская крыша с минимальным уклоном
        netArea = (length * width) * 1.02;

    } else if (roofShape === 'mansard') {
        // Мансардная крыша: крутой нижний скат и пологий верхний
        const lowerPitch = Math.max(45, angle) * Math.PI / 180;
        const upperPitch = 15 * Math.PI / 180;

        let h1 = 2.5; // Примерная высота мансардного этажа
        let inset1 = h1 / Math.tan(lowerPitch);
        if (inset1 > Math.min(width, length) / 2.5) {
            inset1 = Math.min(width, length) / 2.5;
        }

        const outerArea = width * length;
        const innerWidth = Math.max(0, width - 2 * inset1);
        const innerLength = Math.max(0, length - 2 * inset1);
        const innerArea = innerWidth * innerLength;
        const lowerRingArea = outerArea - innerArea;

        const areaLower = lowerRingArea / Math.cos(lowerPitch);
        const areaUpper = innerArea / Math.cos(upperPitch);
        netArea = areaLower + areaUpper;

    } else if (roofShape === 'hip') {
        // Вальмовая крыша: 4 ската под одним углом
        // Геометрически площадь поверхности = Площадь основания / cos(угла)
        netArea = (length * width) / Math.cos(rad);

    } else if (roofShape === 'shed') {
        // Односкатная крыша
        // Площадь поверхности = Площадь основания / cos(угла)
        netArea = (length * width) / Math.cos(rad);

    } else {
        // Двускатная крыша (Gable)
        // Площадь поверхности = Площадь основания / cos(угла)
        netArea = (length * width) / Math.cos(rad);
    }

    if ((roofShape === 'gable' || roofShape === 'hip') && Array.isArray(dormers)) {
        dormers.forEach(d => {
            const dWidth = parseFloat(d.width) || 0;
            const dProj = parseFloat(d.projection) || 0;
            const dSlopeLen = (dWidth / 2) / Math.cos(rad);
            const dormerArea = dSlopeLen * dProj * 2;
            netArea += dormerArea;
        });
    }

    const totalArea = netArea * (1 + wastePct / 100);
    const materialCost = totalArea * materialPrice;
    const laborCost = totalArea * laborRate;
    const grandTotal = materialCost + laborCost;

    res.json({
        netArea: Math.round(netArea * 100) / 100,
        totalArea: Math.round(totalArea * 100) / 100,
        materialCost: Math.round(materialCost),
        laborCost: Math.round(laborCost),
        grandTotal: Math.round(grandTotal)
    });
});

app.listen(PORT, () => {
    console.log(`RoofCalc API is running on http://localhost:${PORT}`);
});

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
        dormers = []
    } = req.body;

    const rad = angle * Math.PI / 180;
    const slopeLen = (width / 2) / Math.cos(rad);
    let netArea = (length * slopeLen) * 2;

    if (Array.isArray(dormers)) {
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

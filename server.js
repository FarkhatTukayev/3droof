const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const path = require('path');
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));
function getPrices() {
    const filePath = path.join(__dirname, 'prices.json');
    if (!fs.existsSync(filePath)) {
        console.error("Файл prices.json не найден по пути:", filePath);
        return {};
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
}
app.get('/api/prices', (req, res) => {
    try {
        const prices = getPrices();
        res.json(prices);
    } catch (err) {
        res.status(500).json({ error: "Failed to load prices" });
    }
});
app.post('/api/calculate', (req, res) => {
    const prices = getPrices();
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
    } = req.body;
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
        netArea = baseArea / Math.cos(rad);
        grossArea = (effLength * realWidth) / Math.cos(rad);
        ridgeLength = realLength;
    }
    if ((roofShape === 'gable' || roofShape === 'hip') && Array.isArray(dormers)) {
        dormers.forEach(d => {
            const dWidth = parseFloat(d.width) || 0;
            const dProj = parseFloat(d.projection) || 0;
            const dSlopeLen = (dWidth / 2) / Math.cos(rad);
            const dormerArea = dSlopeLen * dProj * 2;
            netArea += dormerArea;
            const dEffWidth = Math.ceil(dProj * 2 / sheetWidth) * sheetWidth;
            grossArea += (dSlopeLen * dEffWidth);
        });
    }
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
    res.json({
        netArea: Math.round(netArea * 100) / 100,
        totalArea: Math.round(totalArea * 100) / 100,
        ridgeLength: Math.round(ridgeLength * 100) / 100,
        materialCost: Math.round(materialCost),
        laborCost: Math.round(laborCost),
        grandTotal: Math.round(grandTotal),
        detailedMaterials
    });
});
const { exec } = require('child_process');

app.post('/api/webhook', (req, res) => {
    const secret = req.query.secret;
    if (secret !== '3droof_deploy_secret_2026') {
        return res.status(403).send('Forbidden');
    }

    console.log('Webhook received! Starting deploy...');
    exec('git pull origin main && mkdir -p tmp && touch tmp/restart.txt', (err, stdout, stderr) => {
        if (err) {
            console.error('Deploy error:', err);
            return res.status(500).send('Deploy failed');
        }
        console.log('Deploy successful:', stdout);
        res.status(200).send('Deploy successful');
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`RoofCalc API is running on port ${PORT}`);
});

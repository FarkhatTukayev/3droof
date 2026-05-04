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

function getMoonPhase() {
    const synodic = 29.53058867;
    const knownNewMoon = new Date('2000-01-06T18:14:00Z');
    const now = new Date();
    const diffDays = (now - knownNewMoon) / (1000 * 60 * 60 * 24);
    const cycles = diffDays / synodic;
    return cycles - Math.floor(cycles);
}

function createMoonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 512, 512);
    
    for (let i = 0; i < 150; i++) {
        let x = Math.random() * 512;
        let y = Math.random() * 512;
        let r = Math.random() * 15 + 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - r*0.2, y - r*0.2, r*0.8, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
}

function addHouseDetails(baseMesh, len, wid) {
    const details = new THREE.Group();
    
    // Дверь
    const doorGeo = new THREE.BoxGeometry(1.2, 2.5, 0.1);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, -1.25, len/2 + 0.05); 
    details.add(door);
    
    // Окна
    const winGeo = new THREE.BoxGeometry(1.2, 1.5, 0.1);
    const winMat = new THREE.MeshStandardMaterial({ 
        color: 0x0ea5e9, roughness: 0.1, metalness: 0.9, 
        emissive: 0x0ea5e9, emissiveIntensity: 0.2 
    });
    
    if (wid > 5) {
        const w1 = new THREE.Mesh(winGeo, winMat);
        w1.position.set(-wid/4, -0.5, len/2 + 0.05);
        details.add(w1);
        const w2 = new THREE.Mesh(winGeo, winMat);
        w2.position.set(wid/4, -0.5, len/2 + 0.05);
        details.add(w2);
    }
    
    if (len > 5) {
        const w3 = new THREE.Mesh(winGeo, winMat);
        w3.rotation.y = Math.PI / 2;
        w3.position.set(wid/2 + 0.05, -0.5, 0);
        details.add(w3);
        const w4 = new THREE.Mesh(winGeo, winMat);
        w4.rotation.y = Math.PI / 2;
        w4.position.set(-wid/2 - 0.05, -0.5, 0);
        details.add(w4);
    }
    
    baseMesh.add(details);
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

    // Добавляем Луну
    window.moonLight = new THREE.DirectionalLight(0xffffff, 1.0);
    scene.add(window.moonLight);
    
    const moonGeo = new THREE.SphereGeometry(15, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({ 
        map: createMoonTexture(),
        roughness: 1.0,
        metalness: 0.0
    });
    window.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    window.moonMesh.position.set(-80, 60, -100);
    scene.add(window.moonMesh);

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
    
    addHouseDetails(baseMesh, baseLen, baseWid);
    
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
            addHouseDetails(dBaseMesh, dBaseLen, dormer.width - 0.4);
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
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (window.moonMesh && window.moonLight) {
        window.moonMesh.visible = isDark;
        if (isDark) {
            const phase = getMoonPhase();
            const angle = (phase - 0.5) * Math.PI * 2;
            const lx = window.moonMesh.position.x + Math.sin(angle) * 30;
            const lz = window.moonMesh.position.z + Math.cos(angle) * 30;
            window.moonLight.position.set(lx, window.moonMesh.position.y + 10, lz);
            window.moonLight.target = window.moonMesh;
            window.moonLight.intensity = 1.5;
            
            window.moonMesh.rotation.y += 0.001;
            window.needsRender = true;
        } else {
            window.moonLight.intensity = 0;
        }
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

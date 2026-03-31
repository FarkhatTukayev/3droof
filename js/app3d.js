// app3d.js
// 3D Rendering logic using Three.js

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

// Initialize 3D context
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

    // --- Interactive Drag Handles ---
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
            window.needs3DUpdate = true; // Force final snap
            if (typeof recalculateNumbers === 'function') recalculateNumbers();
        });

        dragControls.addEventListener('drag', function (event) {
            const obj = event.object;
            if (obj.userData.axis === 'x') {
                obj.position.y = 0; // Lock Y
                obj.position.z = 0; // Lock Z
                let newWidth = obj.position.x * obj.userData.sign * 2;
                newWidth = Math.max(2, Math.min(50, newWidth));
                newWidth = Math.round(newWidth * 2) / 2; // Snap to 0.5
                const wInp = document.getElementById('width');
                if (parseFloat(wInp.value) !== newWidth) {
                    wInp.value = newWidth;
                    wInp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (obj.userData.axis === 'z') {
                obj.position.x = 0; // Lock X
                obj.position.y = 0; // Lock Y
                let newLength = obj.position.z * obj.userData.sign * 2;
                newLength = Math.max(2, Math.min(50, newLength));
                newLength = Math.round(newLength * 2) / 2; // Snap to 0.5
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

    // Call animation loop once
    animate();

    // Add window resize listener
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
        // Fallback colors if not matched
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
    lengthDiv.textContent = `${baseLen} м`;
    const lengthLabel = new THREE.CSS2DObject(lengthDiv);
    lengthLabel.position.set(baseWid / 2 + 0.1, -2.5, 0);
    scene.add(lengthLabel);
    labelMeshes.push(lengthLabel);

    const widthDiv = document.createElement('div');
    widthDiv.className = 'dimension-badge';
    widthDiv.textContent = `${baseWid} м`;
    const widthLabel = new THREE.CSS2DObject(widthDiv);
    widthLabel.position.set(0, -2.5, baseLen / 2 + 0.1);
    scene.add(widthLabel);
    labelMeshes.push(widthLabel);

    const canHaveDormers = (shapeType === 'gable' || shapeType === 'hip');
    if (canHaveDormers && window.dormerConfig) {
        window.dormerConfig.forEach((dormer) => {
            const dHeight = Math.tan(angleDeg * Math.PI / 180) * (dormer.width / 2);
            const dShape = createGableShape(dormer.width, dHeight);
            const dExtrusion = dormer.projection + (wid / 2);

            const dRoof = createRoofMesh(dShape, dExtrusion, roofColor, matType);

            dRoof.rotation.y = Math.PI / 2;
            const posZ = dormer.position;
            const shiftOut = (wid / 2) + (dormer.projection / 2) - (dExtrusion / 2) - 0.05;

            dRoof.position.set(shiftOut, 0, posZ);
            scene.add(dRoof);
            roofMeshes.push(dRoof);

            const dBaseGeo = new THREE.BoxGeometry(dormer.projection + (wid / 2) - 0.2, 5, dormer.width - 0.4);
            const dBaseMesh = new THREE.Mesh(dBaseGeo, baseMat);
            dBaseMesh.position.set(shiftOut - 0.1, -2.5, posZ);
            dBaseMesh.receiveShadow = true;
            dBaseMesh.castShadow = true;
            scene.add(dBaseMesh);
            roofMeshes.push(dBaseMesh);
        });
    }

    const maxDim = Math.max(len, wid);
    controls.target.set(0, height / 2, 0);

    if (!window.cameraInitialized) {
        camera.position.set(maxDim * 1.5, maxDim * 0.8, maxDim * 1.5);
        window.cameraInitialized = true;
    }

    // Sync handle positions to match dimensions unless actively dragged
    if (window.resizeHandles && window.resizeHandles.length === 4) {
        if (window.activeDragHandle !== window.resizeHandles[0]) window.resizeHandles[0].position.set(0, 0, baseLen / 2);
        if (window.activeDragHandle !== window.resizeHandles[1]) window.resizeHandles[1].position.set(0, 0, -baseLen / 2);
        if (window.activeDragHandle !== window.resizeHandles[2]) window.resizeHandles[2].position.set(baseWid / 2, 0, 0);
        if (window.activeDragHandle !== window.resizeHandles[3]) window.resizeHandles[3].position.set(-baseWid / 2, 0, 0);
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (controls) controls.update();

    if (window.needs3DUpdate && typeof window.build3DModel === 'function') {
        window.build3DModel();
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
        if (labelRenderer) labelRenderer.render(scene, camera);
    }
}

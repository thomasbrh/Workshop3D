/**
 * IMPORT
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import gsap from "gsap";
/* import { Pane } from 'tweakpane'; */
import GUI from 'lil-gui'
import { Spector } from 'spectorjs'



/** 
 * SETTINGS
 */
const settings = 
{

    wrapper: document.querySelector(".js-canvas-wrapper"),
    canvas: document.querySelector(".js-canvas-3d"),
    raf: window.requestAnimationFrame,
    sizes: {},

};

const threejsOptions = 
{
    canvas: settings.canvas,
};



/**
 * SCENELOADER CLASS
 */
class SceneLoader
{

    constructor(scene)
    {

        this.scene = scene
        this.progress = 0

        // DOM
        this.loadingBarElement = document.querySelector('.loading-bar')
        this.loadingBarBgElement = document.querySelector('.loading-bar-bg')
        this.btnDecouvrir = document.querySelector('.btn-decouvrir')
        this.blurOverlay = document.querySelector('.blur-overlay')

        // overlay three
        this.setOverlay()

        // draco
        this.dracoLoader = new DRACOLoader()
        this.dracoLoader.setDecoderPath('/draco/gltf/')

        // loading manager
        this.loadingManager = new THREE.LoadingManager()

        this.loadingManager.onProgress = (itemUrl, itemsLoaded, itemsTotal) =>
        {

            this.rawProgress = itemsLoaded / itemsTotal
            this.cappedProgress = Math.min(this.rawProgress, 0.95)

            this.progress = Math.max(this.progress, this.cappedProgress)

            this.loadingBarElement.style.transform = `scaleX(${this.progress})`

        }

        this.loadingManager.onLoad = () =>
        {

            window.setTimeout(() =>
            {

                // force le 100%
                this.progress = 1
                this.loadingBarElement.style.transform = 'scaleX(1)'

                this.showStartUI()

                gsap.to(this.overlayMaterial.uniforms.uAlpha, 
                {

                    duration: 0,
                    value: 0,
                    onComplete: () =>
                    {
                        this.loadingBarElement.classList.add('ended')
                        this.loadingBarBgElement.classList.add('ended')
                    }

                })

            }, 1000)

        }

        // loaders
        this.gltfLoader = new GLTFLoader(this.loadingManager)
        this.gltfLoader.setDRACOLoader(this.dracoLoader)

        this.textureLoader = new THREE.TextureLoader(this.loadingManager)

    }

    setOverlay()
    {

        this.overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1)

        this.overlayMaterial = new THREE.ShaderMaterial(
        {

            transparent: true,
            uniforms:
            {
                uAlpha: { value: 1 }
            },
            vertexShader: 
            `
                void main()
                {
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: 
            `
                uniform float uAlpha;

                void main()
                {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
                }
            `

        })

        this.overlayMesh = new THREE.Mesh(this.overlayGeometry, this.overlayMaterial)
        this.scene.add(this.overlayMesh)

    }

    hideOverlay()
    {

        gsap.to(this.overlayMaterial.uniforms.uAlpha, 
        {

            duration: 0.25,
            value: 0

        })

    }

    showStartUI()
    {

        this.blurOverlay.classList.remove('hidden')
        this.btnDecouvrir.classList.remove('hidden')

    }

    hideStartUI()
    {

        this.blurOverlay.classList.add('hidden')
        this.btnDecouvrir.classList.add('hidden')
        this.btnDecouvrir.disabled = true

    }

    loadTexture(path)
    {
        return this.textureLoader.load(path)
    }

    async loadGLTF(path)
    {
        return await this.gltfLoader.loadAsync(path)
    }

}



/** 
 * VIEWER CLASS
 */
class Viewer 
{

    constructor(options) 
    {

        // canvas
        this.canvas = options.canvas;

        // time
        this.clock = new THREE.Clock()

        // experience
        this.experienceStarted = false

        // initialisations
        this.mainGltf = null
        this.mixer = null
        this.clips = []

        this.setRenderer(options);
        this.startButton()

    }


    startButton()
    {

        this.loader.btnDecouvrir.addEventListener('click', () =>
        {

            this.loader.btnDecouvrir.disabled = true

            this.experienceStarted = true

            this.loader.hideStartUI()

            this.playVolets()

        })

    }



    /**
     * loading texture
     */
    loadTexture()
    {

        this.bakedTexture = this.loader.loadTexture('textures/baked_test.webp')
        this.bakedTexture.flipY = false
        this.bakedTexture.colorSpace = THREE.SRGBColorSpace

        this.bakedMaterial = new THREE.MeshBasicMaterial(
        {
            map: this.bakedTexture
        })

    }



    /**
     * loading model gltf
     */
    async loadModel() 
    {

        // Charger la scène
        this.mainGltf = await this.loader.loadGLTF('glb/gltf-main-texture.glb')

        // Charger l'animation'
        this.animPorte = await this.loader.loadGLTF('glb/animations/anim-porte.glb')

        // Add la scène
        this.scene.add(this.mainGltf.scene, this.animPorte.scene)

        // prépare les clips
        // this.animPorte = this.animPorte remove
        this.mixer = new THREE.AnimationMixer(this.animPorte.scene)
        this.clips = this.animPorte.animations

        this.render()

    }



    playVolets() 
    {
    
        this.volet0 = this.clips[0]
        this.volet1 = this.clips[1]
        this.action1 = this.mixer.clipAction(this.volet0)
        this.action2 = this.mixer.clipAction(this.volet1)

        this.action1.reset()
        this.action1.setLoop(THREE.LoopOnce, 1)
        this.action1.clampWhenFinished = true
        this.action1.play()

        this.action2.reset()
        this.action2.setLoop(THREE.LoopOnce, 1)
        this.action2.clampWhenFinished = true
        this.action2.play()

    }



    /**
     * Tracking and travelling camera
     */   
    updateCameraPosition() 
    {

        this.data = this.camerasData[this.indexCamera];

        if (!this.data) return;

        this.camera.position.copy(this.data.position);

        this.controls.target.copy(this.data.target);
        this.controls.update();

    }



    travelling() 
    {

        this.indexCamera = 0;

        this.camerasData = [
            {
                // main camera
                position: new THREE.Vector3(0, 0.75, 5),
                target: new THREE.Vector3(0, -0.75, 0)
            },

            {
                // scène 1
                position: new THREE.Vector3(-0.8, 1.6, 0.6),
                target: new THREE.Vector3(3.5, -0.5, -2.5)
                // position: new THREE.Vector3(0.8, 1.6, 0.4),
                // target: new THREE.Vector3(-3, -2, -2.5)
            },
            
            {
                // scène 2
                position: new THREE.Vector3(-0.4, 0.8, 0.8),
                target: new THREE.Vector3(-0.2, 0.1, -1)
            },

            {
                // scène 3
                position: new THREE.Vector3(0.4, -0.2, 0.8),
                target: new THREE.Vector3(0.5, -0.2, -0.5)
            },

            {
                // scène 4
                position: new THREE.Vector3(0.4, -0.8, 0.8),
                target: new THREE.Vector3(-0.2, -1.5, -1)
            },
        ];

        this.updateCameraPosition();
        this.render();

    }



    /** 
     * populate
     */
    populate() 
    {

        // Tout les éléments à ajouter dans la scene
        // lumière ambiante
        this.sunLight = new THREE.AmbientLight('white', 0.5)

        // lumière directionnel
        this.directionalLight = new THREE.DirectionalLight('white', 3);
        this.directionalLight.position.set(0, 20, 20)

        // add à la scene
        this.scene.add( this.sunLight, this.directionalLight );

        // Demander un rendu
        this.render();

    }



    /** 
     * Gizmo
     */
    removeGizmo() 
    {

        this.scene.remove(this.gizmo);
        this.gizmo.dispose();
        this.gizmo = null;
        this.render();

    }

    addGizmo(size = 1) 
    {

        this.gizmo = new THREE.AxesHelper(size);
        this.scene.add(this.gizmo);
        this.render();

    }



    /**
     * Render
     */
    render(scene = this.scene, camera = this.camera) 
    {

        this.renderer.render(scene, camera);

    }

    setRenderer(options = {}) 
    {

        this.renderer = new THREE.WebGLRenderer(options);

        // Crée notre caméra
        // PerspectiveCamera( fov, aspect-ratio, near, far )
        this.camera = new THREE.PerspectiveCamera(
            75, 
            settings.sizes.w / settings.sizes.h, // On le calcule avec la taille du wrapper
            0.001, // valeur min pour ne pas traverser les objets
            275
        );

        // OrbitControls
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.addEventListener( 'change', () => 
        {
            this.render();
        });

        // Recule notre camera pour qu'on puisse voir le centre de la scene
        this.camera.position.set( 0, 1.2, 1.8) // x, y, z


        // Crée notre scene et y rajoute notre camera
        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        // Loader overlay
        this.loader = new SceneLoader(this.scene)

        // Change une première fois la taille de notre canvas
        this.resize();


        // Appele les fonctions d'ajout d'éléments
        this.loadTexture()
        this.loadModel();

        this.travelling();

        this.populate();

        this.tick()

    }


    /**
     * resize
     */
    resize() 
    {

        // Mettre à jour nos settings
        settings.sizes.w = settings.wrapper.clientWidth;
        settings.sizes.h = settings.wrapper.clientHeight;

        // Limite la densité de pixel à 2, pour éviter des problèmes de performances sur des écrans à plus haute densité de pixel.
        settings.sizes.dpr = Math.min(window.devicePixelRatio, 2);

        settings.canvas.style.aspectRatio = `${settings.sizes.w}/${settings.sizes.h}`;

        // Mettre à jour la camera
        this.camera.aspect = settings.sizes.w / settings.sizes.h;
        this.camera.updateProjectionMatrix();

        // Mettre à jour le moteur de rendu
        this.renderer.setSize(settings.sizes.w, settings.sizes.h);
        this.renderer.setPixelRatio(settings.sizes.dpr);

        this.render();

    }


    /**
     * AnimationFrame tick
     */
    tick() 
    {

        // initialisé l'horloge
        this.delta = this.clock.getDelta()

        if (this.mixer) 
        {
            this.mixer.update(this.delta)
        }


        // faire un rendu
        this.render()

        // prochaine frame
        requestAnimationFrame(() => this.tick())

    }

}


/**
 * myViewer
 */
const myViewer = new Viewer(threejsOptions);
myViewer.addGizmo(2); // envie de tweak ça

// Ajouter un event resize et appeler la fonction qui gère les changements de tailles
window.addEventListener("resize", () => 
{

    myViewer.resize();

});



/** 
 * Event tracking camera
 */
// !!!!!!!!!! add un cooldown pour l'animation
window.addEventListener("keydown", (event) => 
{

    if (!myViewer.experienceStarted) return
    if (event.key !== "e") return

    const length = myViewer.camerasData.length
    myViewer.indexCamera = (myViewer.indexCamera + 1) % length

    const data = myViewer.camerasData[myViewer.indexCamera]

    if (!data) return

    gsap.to(myViewer.camera.position, {

        duration: 1,
        x: data.position.x,
        y: data.position.y,
        z: data.position.z,

        onUpdate: () => 
        {

            myViewer.controls.target.copy(data.target)
            myViewer.controls.update()
            myViewer.render()

        }

    })

})



/** 
 * Debug
 */
/* const pane = new Pane(); */

// remettre en tweakpane 

const debugActive = window.location.hash.includes('debug')

if(debugActive)
{

    const debugObject = 
    {
        
        camera: myViewer.camera
        
    }

    // lil-gui
    const gui = new GUI(
    { 

        name: 'debug',
        width: 400

    })

    // spector.js
    const spector = new Spector()
    spector.displayUI()


    // debug camera
    const cameraFolder = gui.addFolder('Camera')

    cameraFolder.add(debugObject.camera.position, 'x').min(-10).max(200).step(0.1)
    .onChange(() => 
    {

        myViewer.render()

    })

    cameraFolder.add(debugObject.camera.position, 'y').min(-10).max(200).step(0.1)
    .onChange(() => 
    {

        myViewer.render()

    })

    cameraFolder.add(debugObject.camera.position, 'z').min(-10).max(200).step(0.1)
    .onChange(() => 
    {

        myViewer.render()
        
    })

    // debug camera target
    const targetFolder = gui.addFolder('Camera Target')

    targetFolder.add(myViewer.controls.target, 'x').min(-10).max(10).step(0.1)
    .onChange(() => 
    {

        myViewer.controls.update()
        myViewer.render()

    })

    targetFolder.add(myViewer.controls.target, 'y').min(-10).max(10).step(0.1)
    .onChange(() => 
    {

        myViewer.controls.update()
        myViewer.render()

    })

    targetFolder.add(myViewer.controls.target, 'z').min(-10).max(10).step(0.1)
    .onChange(() => 
    {

        myViewer.controls.update()
        myViewer.render()

    })

}
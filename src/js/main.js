import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import gsap from "gsap";
import { Pane } from 'tweakpane';
import GUI from 'lil-gui'



/**
 * Loader setup
 */

// Draco loader
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

// loadingManager
const loadingManager = new THREE.LoadingManager()

// Gltf loader
const gltfLoader = new GLTFLoader(loadingManager)
gltfLoader.setDRACOLoader(dracoLoader)

// Texture loader
const textureLoader = new THREE.TextureLoader(loadingManager)



/**
 * Loading progress onLoad()
 */
// const onLoad()
const loaderManager = document.querySelector(".loader-manager")
const btnDecouvrir = document.querySelector(".btn-decouvrir")
const blurOverlay = document.querySelector(".blur-overlay")
let experienceStarted = false


// une fois chargé on enlève
loadingManager.onLoad = () => 
{
    loaderManager.classList.add("hidden")
    
    blurOverlay.classList.remove("hidden")
    btnDecouvrir.classList.remove("hidden")
    
}


/**
 * Start 
 */
btnDecouvrir.addEventListener("click", () => {

    // protection db click
    btnDecouvrir.disabled = true

    // expérience commence
    experienceStarted = true
    blurOverlay.classList.add("hidden")
    btnDecouvrir.classList.add("hidden")

    // joue la première animation
    myViewer.playVolets()

})



/** 
 * SETTINGS
 */
const settings = {

    wrapper: document.querySelector(".js-canvas-wrapper"),
    canvas: document.querySelector(".js-canvas-3d"),
    raf: window.requestAnimationFrame,
    sizes: {},

};

const threejsOptions = {

    canvas: settings.canvas,

};



/**
 * Texturing
 */
const bakedTexture = textureLoader.load('/baked.webp')
bakedTexture.flipY = false
bakedTexture.colorSpace = THREE.SRGBColorSpace

// Create material for gltf
const bakedMaterial = new THREE.MeshBasicMaterial({ map: bakedTexture })



/** 
 * VIEWER CLASS
 */

// viewer class
class Viewer {
    constructor(options) {

        this.canvas = options.canvas;

        this.setRenderer(options);

        // initialisations
        this.mainGltf = null
        this.mixer = null
        this.clips = []

    }



    /**
     * loading model gltf
     */
    async loadModel() {

        // Charger la scène
        const mainGltf = await gltfLoader.loadAsync('/gltf-main-merge.glb')

        // prépare les clips
        this.mainGltf = mainGltf
        this.mixer = new THREE.AnimationMixer(mainGltf.scene)
        this.clips = mainGltf.animations

        // Add la scène
        this.scene.add(mainGltf.scene)

        this.render()

    }



    playVolets() {
    
        /* const clip = this.clips[0]
        const action = this.mixer.clipAction(clip)

        action.reset()
        action.play() */

    }



    /**
     * Tracking and travelling camera
     */   
    updateCameraPosition() {

        const data = this.camerasData[this.indexCamera];

        if (!data) return;

        this.camera.position.copy(data.position);

        this.controls.target.copy(data.target);
        this.controls.update();

    }



    travelling() {

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
    populate() {

        // Tout les éléments à ajouter dans la scene
        // lumière ambiante
        const sunLight = new THREE.AmbientLight('white', 0.5)
        // lumière directionnel
        const directionalLight = new THREE.DirectionalLight('white', 3);
        directionalLight.position.set(0, 20, 20)

        this.scene.add( sunLight, directionalLight );

        // Demander un rendu
        this.render();

    }



    /** 
     * Gizmo
     */
    removeGizmo() {

        this.scene.remove(this.gizmo);
        this.gizmo.dispose();
        this.gizmo = null;
        this.render();

    }

    addGizmo(size = 1) {

        this.gizmo = new THREE.AxesHelper(size);
        this.scene.add(this.gizmo);
        this.render();

    }



    /**
     * Render
     */
    render(scene = this.scene, camera = this.camera) {

        this.renderer.render(scene, camera);

    }

    setRenderer(options = {}) {

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
        } 
        );

        // Recule notre camera pour qu'on puisse voir le centre de la scene
        this.camera.position.set( 0, 1.2, 1.8) // x, y, z


        // Crée notre scene et y rajoute notre camera
        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        // Change une première fois la taille de notre canvas
        this.resize();


        // Appele les fonctions d'ajout d'éléments
        this.loadModel();
        this.travelling();
        this.populate();

    }


    /**
     * resize
     */
    resize() {

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
}


/**
 * myViewer
 */
const myViewer = new Viewer(threejsOptions);
myViewer.addGizmo(2);

// Ajouter un event resize et appeler la fonction qui gère les changements de tailles
window.addEventListener("resize", () => {

    myViewer.resize();

});



/** 
 * Event tracking camera
 */
window.addEventListener("keydown", (event) => {

    if (!experienceStarted) return
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

        onUpdate: () => {
            myViewer.controls.target.copy(data.target)
            myViewer.controls.update()
            myViewer.render()
        }
    })

})



/** 
 * Debug
 */
const pane = new Pane();

// remettre en tweakpane 
const debugObject = {

    camera: myViewer.camera

}

const gui = new GUI({ 
    name: 'debug',
    width: 400
})

// debug camera
const cameraFolder = gui.addFolder('Camera')

cameraFolder.add(debugObject.camera.position, 'x').min(-10).max(200).step(0.1)
.onChange(() => {

    myViewer.render()

})

cameraFolder.add(debugObject.camera.position, 'y').min(-10).max(200).step(0.1)
.onChange(() => {

    myViewer.render()

})

cameraFolder.add(debugObject.camera.position, 'z').min(-10).max(200).step(0.1)
.onChange(() => {

    myViewer.render()
    
})

// debug camera target
const targetFolder = gui.addFolder('Camera Target')

targetFolder.add(myViewer.controls.target, 'x').min(-10).max(10).step(0.1)
.onChange(() => {

    myViewer.controls.update()
    myViewer.render()

})

targetFolder.add(myViewer.controls.target, 'y').min(-10).max(10).step(0.1)
.onChange(() => {

    myViewer.controls.update()
    myViewer.render()

})

targetFolder.add(myViewer.controls.target, 'z').min(-10).max(10).step(0.1)
.onChange(() => {

    myViewer.controls.update()
    myViewer.render()

})
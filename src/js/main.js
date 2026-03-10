import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import gsap from "gsap";
import { Pane } from 'tweakpane';
import GUI from 'lil-gui'

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
 * Loader
 */

// Draco loader
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

// Gltf loader
const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)



/** 
 * VIEWER CLASS
 */

// viewer class
class Viewer {
    constructor(options) {
        this.canvas = options.canvas;

        this.setRenderer(options);
        
    }



    /**
     * loading model gltf
     */
    async loadModel() {
        const mainGltf = await gltfLoader.loadAsync('/gltf-main-merge.glb')
        console.log(mainGltf)
        this.scene.add(mainGltf.scene)
        this.render()
    }



    /**
     * Tracking and travelling camera
     */
    updateCameraPosition() {
        const newPosition = this.cameraPositions[ this.indexCamera ];
        this.camera.position.set( newPosition.x, newPosition.y, newPosition.z );
        this.camera.lookAt(0,0,0);
    }
    
    travelling() {

        this.indexCamera = 0;
        this.cameraPositions = [];

        const geometry = new THREE.BoxGeometry( 0.5, 0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({
            color: 'crimson'
        });


        /**
         * Camera positions debug
         */
        const cam1 = new THREE.Mesh( geometry, material );
        cam1.position.x = 0.5;
        cam1.position.y = 1.5;
        cam1.position.z = 1.9;
        cam1.visible = false; 

        const cam2 = new THREE.Mesh( geometry, material );

        cam2.position.x = -0.5;
        cam2.position.y = 0.8;
        cam2.position.z = 1.9;
        cam2.visible = false;

        const cam3 = new THREE.Mesh( geometry, material );

        cam3.position.x = 0.5;
        cam3.position.y = 0;
        cam3.position.z = 1.9;
        cam3.visible = false;

        this.cameraPositions.push(cam1.position, cam2.position, cam3.position);
        
        this.scene.add( cam1, cam2, cam3 );
        this.updateCameraPosition();
        this.render();


        const lookAt1 = new THREE.Mesh( geometry, material );
        lookAt1.position.x = 0.5;
        lookAt1.position.y = 1.5;
        lookAt1.position.z = 0.5;
        lookAt1.visible = false;

        const debug2 = new THREE.Mesh( geometry, material );

        debug2.position.x = -0.5;
        debug2.position.y = 0.8;
        debug2.position.z = 1.9;
        debug2.visible = false;

        const debug3 = new THREE.Mesh( geometry, material );

        debug3.position.x = 0.5;
        debug3.position.y = 0;
        debug3.position.z = 1.9;
        debug3.visible = false;

        this.scene.add( lookAt1, debug2, debug3 );
    }



    /** 
     * populate
     */
    populate() {
        // Tout les éléments à ajouter dans la scene
        /* this.scene.add(mainGltf.scene); */

        const sunLight = new THREE.AmbientLight('white', 0.75)

        this.scene.add( sunLight );

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
            0.01, // valeur min pour ne pas traverser les objets
            100
        );

        // OrbitControls
        /* this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.addEventListener( 'change', () => 
        {
            this.render();
        } 
        ); */

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
/* myViewer.addGizmo(2); */

// Ajouter un event resize et appeler la fonction qui gère les changements de tailles
window.addEventListener("resize", () => {
    myViewer.resize();
});



/** 
 * Event tracking camera
 */
window.addEventListener("click", () => {
    myViewer.indexCamera++;
    const length = myViewer.cameraPositions.length;
    gsap.to( myViewer.camera.position, {
        duration: 1,
        x: myViewer.cameraPositions[ myViewer.indexCamera % length ].x,
        y: myViewer.cameraPositions[ myViewer.indexCamera % length ].y,
        z: myViewer.cameraPositions[ myViewer.indexCamera % length ].z,
        onUpdate: () => {
            myViewer.camera.lookAt(0, 0, 0.5);
            myViewer.render();
        }
    });
    myViewer.camera.lookAt(0, 0, 0.5);
    myViewer.render();
});



/** 
 * Debug Pane
 */
const pane = new Pane();

// remettre en tweakpane 
const debugObject = {
    camera: myViewer.camera
}

const gui = new GUI({ width: 400 })

const cameraFolder = gui.addFolder('Camera')

cameraFolder.add(debugObject.camera.position, 'x').min(-10).max(200).step(0.1)
.onChange(() => {
    myViewer.render()
    console.log(myViewer.camera.position)
})

cameraFolder.add(debugObject.camera.position, 'y').min(-10).max(200).step(0.1)
.onChange(() => {
    myViewer.render()
    console.log(myViewer.camera.position)
})

cameraFolder.add(debugObject.camera.position, 'z').min(-10).max(200).step(0.1)
.onChange(() => {
    myViewer.render()
    console.log(myViewer.camera.position)
})
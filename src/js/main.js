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
        this.startBtn = document.querySelector('.start-btn')
        this.instructions = document.querySelector('.instructions')
        this.blurOverlay = document.querySelector('.blur-overlay')

        // l'overlay three.js
        this.setOverlay()

        // draco
        this.dracoLoader = new DRACOLoader()
        this.dracoLoader.setDecoderPath('/draco/gltf/')

        // loading manager
        this.loadingManager = new THREE.LoadingManager()
        
        this.loadingManager.onProgress = (itemUrl, itemsLoaded, itemsTotal) =>
        {
            // calcul la réelle progression 
            this.loadProgress = itemsLoaded / itemsTotal

            // calcul la progression affichée
            this.displayProgress = Math.min(this.loadProgress, 0.95)

            // garde la plus grande des deux
            this.progress = Math.max(this.progress, this.displayProgress)

            // incrémente la barre en fonction du progrès
            this.loadingBarElement.style.transform = `scaleX(${this.progress})`
        }

        this.loadingManager.onLoad = () =>
        {
            window.setTimeout(() =>
            {
                // passer de 95 à 100 quand c'est loadé
                this.progress = 1
                this.loadingBarElement.style.transform = 'scaleX(1)'

                // appelle le blur et btn
                this.showStartUI()

                // animation gsap qui va enlever la barre 
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
            }, 5000)
        }

        // loader gltf
        this.gltfLoader = new GLTFLoader(this.loadingManager)
        this.gltfLoader.setDRACOLoader(this.dracoLoader)

        // loader texture
        this.textureLoader = new THREE.TextureLoader(this.loadingManager)

        // loader audio
        this.audioLoader = new THREE.AudioLoader(this.loadingManager)
    }


    // crée l'overlay
    setOverlay()
    {
        this.overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1)
        // materiel de l'overlay
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
                    gl_FragColor = vec4(0.0, 0.45, 0.0, uAlpha);
                }
            `

        })

        // crée le mesh de l'overlay
        this.overlayMesh = new THREE.Mesh(this.overlayGeometry, this.overlayMaterial)
        this.scene.add(this.overlayMesh)
    }


    // affiche le blur et startbtn
    showStartUI()
    {
        this.blurOverlay.classList.remove('hidden')
        this.startBtn.classList.remove('hidden')
    }


    // cache le blur et startbtn
    hideStartUI()
    {
        this.blurOverlay.classList.add('hidden')
        this.startBtn.classList.add('hidden')
        this.startBtn.disabled = true
    }


    showInstructions()
    {
        this.instructions.classList.remove('hidden')
    }


    hideInstructions()
    {
        this.instructions.classList.add('hidden')
    }


    // récupère les chemins pour alimenter this.loadingManager
    async loadTexture(path)
    {
        return this.textureLoader.load(path)
    }


    // récupère les chemins pour alimenter this.loadingManager
    async loadGLTF(path)
    {
        return await this.gltfLoader.loadAsync(path)
    }


    // récupère les chemins pour alimenter this.loadingManager
    async loadAudio(path)
    {
        return await this.audioLoader.loadAsync(path)
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

        // audio
        this.audioListener = null
        this.audioLoader = null
        this.ambienceSound = null

        this.setRenderer(options);
    }


    /**
     * Loading texture
     */
    async loadTexture()
    {
        /* texture principale */
        this.bakedImageTexture = await this.loader.loadTexture('/textures/bakedImageTexture.webp')
        this.bakedImageTexture.flipY = false
        this.bakedImageTexture.colorSpace = THREE.SRGBColorSpace

        this.bakedImageMaterial = new THREE.MeshStandardMaterial(
        {
            map: this.bakedImageTexture
        })

        /* texture des animations */
        this.bakedAnimationsTexture = await this.loader.loadTexture('/textures/bakedAnimationsTexture.webp')
        this.bakedAnimationsTexture.flipY = false
        this.bakedAnimationsTexture.colorSpace = THREE.SRGBColorSpace

        this.bakedAnimationsMaterial = new THREE.MeshStandardMaterial(
        {
            map: this.bakedAnimationsTexture
        })

        /* texture des personnages */
        this.bakedPersonnagesTexture = await this.loader.loadTexture('/textures/bakedPersonnagesTexture.webp')
        this.bakedPersonnagesTexture.flipY = false
        this.bakedPersonnagesTexture.colorSpace = THREE.SRGBColorSpace

        this.bakedPersonnagesMaterial = new THREE.MeshStandardMaterial(
        {
            map: this.bakedPersonnagesTexture
        })
    }


    /**
     * Loading model gltf
     */
    async loadModel() 
    {
        /* glb principal */
        this.mainGltf = await this.loader.loadGLTF('/glb/G1_interieur.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.mainGltf.scene.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.material = this.bakedImageMaterial
            }
        })


        /* glb animations */
        this.animationsGltf = await this.loader.loadGLTF('/glb/animations/animations.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.animationsGltf.scene.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.material = this.bakedAnimationsMaterial
            }
        })


        /* glb personnages */
        this.personnagesGltf = await this.loader.loadGLTF('/glb/personnages/personnages.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.personnagesGltf.scene.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.material = this.bakedPersonnagesMaterial
            }
        })

        // Add la scène
        this.scene.add(this.mainGltf.scene, this.animationsGltf.scene, this.personnagesGltf.scene)
        console.log(this.animationsGltf)

        // prépare les clips
        this.mixer = new THREE.AnimationMixer(this.animationsGltf.scene)
        this.clips = this.animationsGltf.animations

        this.render()
    }


    /**
     * son
     */
    setAudio()
    {
        // ajoute du son à la camera
        this.audioListener = new THREE.AudioListener()
        this.camera.add(this.audioListener)
    }

    // musique de fond
    async loadGlobalAudio()
    {
        this.ambienceSound = new THREE.Audio(this.audioListener)

        const buffer = await this.loader.loadAudio('/son/ambience/ambience.wav')

        this.ambienceSound.setBuffer(buffer)
        this.ambienceSound.setLoop(true)
        this.ambienceSound.setVolume(0.4)
    }


    // bloc play animation animation
    playClip(index, isInfinite = true) 
    {
        if (!this.mixer || !this.clips[index]) 
            return

            const action = this.mixer.clipAction(this.clips[index])
        
            action.reset()

            if (isInfinite) 
            {
                // loop
                action.setLoop(THREE.LoopRepeat, Infinity)
                action.clampWhenFinished = false
            } 
            else 
            {
                // 1 fois (no loop)
                action.setLoop(THREE.LoopOnce, 1)
                action.clampWhenFinished = true
            }

        action.play()
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
        this.directionalLight = new THREE.DirectionalLight('white', 5);
        this.directionalLight.position.set(0, 10, 10)

        const helper = new THREE.DirectionalLightHelper( this.directionalLight, 5 );
        this.scene.add( helper );

        // add à la scene
        this.scene.add( this.sunLight, this.directionalLight );

        // Demander un rendu
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

        // Crée notre scene et y rajoute notre camera
        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        // loaderManager
        this.loader = new SceneLoader(this.scene)

        // ajout du son à la camera
        this.setAudio()

        // OrbitControls
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.addEventListener( 'change', () => 
        {
            this.render();
        });
        // dispo en debug
        this.controls.enabled = false 

        // Recule notre camera pour qu'on puisse voir le centre de la scene
        // camera main
        this.camera.position.set( 0, 0.5, 7.5) // x, y, z
        this.camera.lookAt(0, -1, -1.5) // x, y, z


        // Change une première fois la taille de notre canvas
        this.resize();


        // Appele les fonctions de chargement des éléments
        this.loadTexture()
        this.loadModel();
        this.loadGlobalAudio()

        this.populate();

        this.tick()

    }


    /**
     * Cameras
     */
    setCamera(position, target)
    {
        this.camera.position.copy(position)
        this.controls.target.copy(target)
        this.controls.update()
        this.render()
    }


    // déplacer les cameras
    moveCamera(position, target, duration = 1, onComplete = null)
    {
        // changer la position
        gsap.to(this.camera.position, 
        {
            x: position.x,
            y: position.y,
            z: position.z,
            duration,
            ease: 'power2.inOut'
        })

        // changer l'angle de vue
        gsap.to(this.controls.target, 
        {
            x: target.x,
            y: target.y,
            z: target.z,
            duration,
            ease: 'power2.inOut',
            onUpdate: () =>
            {

                this.controls.update()
                this.render()

            },
            onComplete: () =>
            {

                this.controls.update()
                this.render()

                if(onComplete) onComplete()

            }
        })
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

        // update du mixer/animations
        if (this.mixer) 
        {
            this.mixer.update(this.delta)
        }


        // faire un rendu
        this.render()

        // prochaine frame
        requestAnimationFrame(() => this.tick())

    }


    /** 
     * Gizmo
     */
    removeGizmo() 
    {
        if(!this.gizmo) return

        this.scene.remove(this.gizmo);
        this.gizmo.dispose();
        this.gizmo = null;
        this.render();
    }


    addGizmo(size = 1) 
    {
        if(this.gizmo) return

        this.gizmo = new THREE.AxesHelper(size);
        this.scene.add(this.gizmo);
        this.render();
    }

}



/**
 * DIALOGUE CLASS
 */
class DialogueBox 
{

    constructor() 
    {
        this.box = document.querySelector('.dialogue-box')
        this.text = document.querySelector('.dialogue-text')
    }


    show(content) 
    {
        this.text.textContent = content
        this.box.classList.remove('hidden')
    }


    hide() 
    {
        this.box.classList.add('hidden')
        this.text.textContent = '' 
    }

}



/**
 * STORYMANAGER CLASS
 */
class StoryManager 
{
    
    constructor(viewer)
    {
        this.viewer = viewer

        this.dialogueBox = new DialogueBox()

        this.locked = true
        this.currentScene = null

        this.intro  = new Intro(viewer, this)
        this.scene1 = new Scene1(viewer, this)
        this.scene2 = new Scene2(viewer, this)
        this.scene3 = new Scene3(viewer, this)
        this.scene4 = new Scene4(viewer, this)
        this.outro  = new Outro(viewer, this)

        this.scenes = 
        {

            intro : this.intro,
            scene1: this.scene1,
            scene2: this.scene2,
            scene3: this.scene3,
            scene4: this.scene4,
            outro : this.outro

        }

        this.bindEvents()
    }


    bindEvents()
    {
        // écoute si le startbtn est cliqué
        this.viewer.loader.startBtn.addEventListener('click', () =>
        {
            // commence l'expérience si il est cliqué
            if (this.viewer.experienceStarted) return
            this.viewer.experienceStarted = true

            // autorise l'audio
            this.viewer.audioListener.context.resume()

            // lance la muisque d'ambiance
            if (this.viewer.ambienceSound?.buffer && !this.viewer.ambienceSound.isPlaying)
            {
                this.viewer.ambienceSound.play()
            }

            // continue vers intro
            this.goTo('intro')
        })

        window.addEventListener('keydown', (event) =>
        {
            if (!this.viewer.experienceStarted) return
            if (this.locked) return
            if (event.key.toLowerCase() !== 'e') return

            this.currentScene?.interact?.()
        })
    }


    goTo(name)
    {
        if (this.currentScene?.exit)
        {
            this.currentScene.exit()
        }

        this.currentScene = this.scenes[name]
        this.currentScene?.enter?.()
    }


    lock()
    {
        this.locked = true
        this.viewer.loader.hideInstructions()
    }


    unlock()
    {
        this.locked = false
        this.viewer.loader.showInstructions()
    }

}



/**
 * INTRO CLASS
 */
class Intro
{
    
    constructor(viewer, storyManager)
    {
        this.viewer = viewer
        this.storyManager = storyManager

        this.clickBtnSound = new THREE.Audio(this.viewer.audioListener)
        this.voletSound = new THREE.Audio(this.viewer.audioListener)

        this.loadAudio()
    }


    async loadAudio()
    {
        const btnBuffer = await this.viewer.loader.loadAudio('/son/btn/btn-start.wav')
        this.clickBtnSound.setBuffer(btnBuffer)
        this.clickBtnSound.setLoop(false)
        this.clickBtnSound.setVolume(0.4)

        const voletBuffer = await this.viewer.loader.loadAudio('/son/animations/animations-volets.wav')
        this.voletSound.setBuffer(voletBuffer)
        this.voletSound.setLoop(false)
        this.voletSound.setVolume(1)
    }


    enter()
    {
        this.storyManager.lock()

        this.viewer.loader.startBtn.disabled = true
        this.viewer.loader.hideStartUI()

        if (this.clickBtnSound.buffer)
        {
            this.clickBtnSound.play()
        }
        
        this.playOpenVolets()

        setTimeout(() =>
        {
            this.storyManager.unlock()
        }, 1800) // cd avant d'enabled les controls
    }


    playOpenVolets()
    {
        if (this.voletSound.buffer)
        {
            this.voletSound.play()
        }

        if (!this.viewer.mixer || this.viewer.clips.length < 2) return

        const volet0 = this.viewer.clips[0]
        const volet1 = this.viewer.clips[1]

        const action1 = this.viewer.mixer.clipAction(volet0)
        const action2 = this.viewer.mixer.clipAction(volet1)

        action1.reset()
        action1.setLoop(THREE.LoopOnce, 1)
        action1.clampWhenFinished = true
        action1.play()

        action2.reset()
        action2.setLoop(THREE.LoopOnce, 1)
        action2.clampWhenFinished = true
        action2.play()
    }


    interact()
    {
        this.storyManager.goTo('scene1')
    }

}



/**
 * SCENE1 CLASS
 */
class Scene1
{

    constructor(viewer, storyManager)
    {
        this.viewer = viewer
        this.storyManager = storyManager
        this.step = 0

        // camera scène 1
        this.cameraPosition = new THREE.Vector3(-0.5, 0.1, 1.4)
        this.cameraTarget = new THREE.Vector3(0.5, 0.1, -1.4)
    }


    enter()
    {
        this.storyManager.lock()
        this.step = 0

        // camera scène 1
        this.viewer.moveCamera(this.cameraPosition, this.cameraTarget, 3.5, () => 
        {
            this.storyManager.dialogueBox.show("G1: T'es sur que ça va ?")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)
        })
    }


    interact()
    {
        if (this.step === 0) 
        {
            
            this.storyManager.lock()
            this.step = 1
            
            this.storyManager.dialogueBox.show("G2: Oui ça ma juste blessé..")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return 
        }

        if (this.step === 1) 
        {
            this.storyManager.lock()
            this.step = 2

            this.storyManager.dialogueBox.show("G1: C'est juste un connard, je vais m'en occupé !")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return
        }

        if (this.step === 2) 
        {
            this.storyManager.lock()
            this.step = 3

            this.storyManager.dialogueBox.show("G2: Non, ne t'inquiètes pas tu risques d'empirer les choses..")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return
        }

        this.storyManager.dialogueBox.hide()
        this.storyManager.goTo('scene2')
    }

}



/**
 * SCENE2 CLASS
 */
class Scene2
{

    constructor(viewer, storyManager)
    {
        this.viewer = viewer
        this.storyManager = storyManager
        this.step = 0

        // camera scène 2
        this.cameraPosition = new THREE.Vector3(-0.5, -0.7, 1.4)
        this.cameraTarget = new THREE.Vector3(2.4, -1, -2)
    }


    enter()
    {
        this.storyManager.lock()
        this.step = 0

        // camera scène 2
        this.viewer.moveCamera(this.cameraPosition, this.cameraTarget, 2, () =>
        {
            this.storyManager.dialogueBox.show("G1: Pourquoi tu as encore utilisé ma brosse à dents !!!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)
            
            // animation frog
            this.viewer.playClip(2, false)
        })
    }


    interact()
    {

        if (this.step === 0) 
        {
            this.storyManager.lock()
            this.step = 1

            this.storyManager.dialogueBox.show("P1: Parce qu'elle est mieux peut-être ?!!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return
        }

        if (this.step === 1) 
        {
            this.storyManager.lock()
            this.step = 2

            this.storyManager.dialogueBox.show("G1: C'est pas une raison ! C'est MA brosse à dents, ne t'avises plus de l'utiliser !!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return
        }

        this.storyManager.dialogueBox.hide()
        this.storyManager.goTo('scene3')
    }

}



/**
 * SCENE3 CLASS
 */
class Scene3
{
    
    constructor(viewer, storyManager)
    {
        this.viewer = viewer
        this.storyManager = storyManager
        this.step = 0

        // camera scène 3 
        this.cameraPosition = new THREE.Vector3(0.6, -1.5, 1.6)
        this.cameraTarget = new THREE.Vector3(-2.5, -0.8, -8.5)
    }


    enter()
    {
        this.storyManager.lock()
        this.step = 0
        // animation lustre
        this.viewer.playClip(3, true)
        this.viewer.playClip(4, true)

        // camera scène 3
        this.viewer.moveCamera(this.cameraPosition, this.cameraTarget, 3, () =>
        {
            this.storyManager.dialogueBox.show("G1: Mais qu'est ce qu'il fait perché la en haut ?")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)
        })
    }


    interact()
    {
        if (this.step === 0) 
        {
            this.storyManager.lock()
            this.step = 1

            this.storyManager.dialogueBox.show("G2: Honnêtement je ne sais pas, vraiment bizarre ce peuple..")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return
        }

        if (this.step === 1) 
        {
            this.storyManager.lock()
            this.step = 2

            this.storyManager.dialogueBox.show("P1: Mais aider-moi à descendre non ?!!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return
        }

        this.storyManager.dialogueBox.hide()
        this.storyManager.goTo('scene4')
    }

}



/**
 * SCENE4 CLASS
 */
class Scene4
{
    
    constructor(viewer, storyManager)
    {
        this.viewer = viewer
        this.storyManager = storyManager
        this.step = 0

        // camera scène 4 
        this.cameraPosition = new THREE.Vector3(0.5, -2.1, 1.6)
        this.cameraTarget = new THREE.Vector3(-2, -2.5, -10)
    }


    enter()
    {
        this.storyManager.lock()
        this.step = 0

        // camera scène 4
        this.viewer.moveCamera(this.cameraPosition, this.cameraTarget, 2, () =>
        {
            this.storyManager.dialogueBox.show("P1: J'ai superrrr faimmm !!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)
        })
    }


    interact()
    {
        if (this.step === 0) 
        {

            this.storyManager.lock()
            this.step = 1

            this.storyManager.dialogueBox.show("P2: Comme d'habitude ils sont encore en retard...")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return

        }

        if (this.step === 1) 
        {
            this.storyManager.lock()
            this.step = 2

            this.storyManager.dialogueBox.show("P1: J'en ai marre d'attendre, c'est toujours les mêmes !!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 1500)

            return
        }

        this.storyManager.dialogueBox.hide()
        this.storyManager.goTo('outro')
    }
    
}



/**
 * OUTRO CLASS
 */
class Outro
{
    
    constructor(viewer, storyManager)
    {
        this.viewer = viewer
        this.storyManager = storyManager
        this.step = 0

        // camera main
        this.cameraPosition = new THREE.Vector3(0, 0.5, 7.5)
        this.cameraTarget = new THREE.Vector3(0, -1, -1.5)
    }

    
    enter()
    {
        this.storyManager.lock()
        this.step = 0
        this.viewer.moveCamera(this.cameraPosition, this.cameraTarget, 3.5, () =>
        {
            this.playCloseVolets()
        })
    }


    playCloseVolets()
    {
        if (!this.viewer.mixer || this.viewer.clips.length < 2) return

        const volet0 = this.viewer.clips[0]
        const volet1 = this.viewer.clips[1]

        const action1 = this.viewer.mixer.clipAction(volet0)
        const action2 = this.viewer.mixer.clipAction(volet1)

        action1.reset()
        action2.reset()

        // On place la tête de lecture à la toute fin de l'animation
        action1.time = volet0.duration
        action2.time = volet1.duration

        // on joue à l'envers
        action1.timeScale = -1
        action2.timeScale = -1

        // on laisse le onFinish
        action1.setLoop(THREE.LoopOnce, 1)
        action1.clampWhenFinished = true
        action2.setLoop(THREE.LoopOnce, 1)
        action2.clampWhenFinished = true

        action1.play()
        action2.play()
    }

}


/**
 * myViewer
 */
const myViewer = new Viewer(threejsOptions);
const storyManager = new StoryManager(myViewer)

// Ajouter un event resize et appeler la fonction qui gère les changements de tailles
window.addEventListener("resize", () => 
{
    myViewer.resize();
});



/**
 * DEBUG CLASS
 */
class Debug
{

    constructor()
    {
        // demande #debug dans le chemin
        this.debugActive = window.location.hash.includes('debug')

        // si debug actif
        if(this.debugActive)
        {
            // objet a debug
            this.debugObject = 
            {
                orbitControls: false,
                gizmo: false,
                camera: myViewer.camera,
            }

            // lil-gui
            this.gui = new GUI(
            { 
                name: 'debug',
                width: 400
            })

            // spector.js
            this.spector = new Spector()
            this.spector.displayUI()

            // debugFolder
            this.cameraDebug()
            this.guizmoDebug()
            this.orbitControlsDebug()
        }
    }

    /**
     * OrbitControls
     */
    orbitControlsDebug()
    {
        this.gui
            .add(this.debugObject, 'orbitControls')
            .name('Orbit controls')
            .onChange((value) =>
            {
                myViewer.controls.enabled = value
                myViewer.render()
            })
    }


    /**
     * debug guizmo 
     * */
    guizmoDebug()
    {
        this.gui
        .add(this.debugObject, 'gizmo')
        .name('Afficher gizmo')
        .onChange((value) =>
        {
            if(value)
            {
                myViewer.addGizmo(2)
            }
            else
            {
                myViewer.removeGizmo()
            }
        })
    }


    /**
     * debug camera
     */
    cameraDebug()
    {
        // debug camera
        this.cameraFolder = this.gui.addFolder('Camera')

        this.cameraFolder.add(this.debugObject.camera.position, 'x').min(-10).max(200).step(0.1)
        .onChange(() => 
        {
            myViewer.render()
        })

        this.cameraFolder.add(this.debugObject.camera.position, 'y').min(-10).max(200).step(0.1)
        .onChange(() => 
        {
            myViewer.render()
        })

        this.cameraFolder.add(this.debugObject.camera.position, 'z').min(-10).max(200).step(0.1)
        .onChange(() => 
        {
            myViewer.render()
        })

        // debug camera target
        this.targetFolder = this.gui.addFolder('Camera Target')

        this.targetFolder.add(myViewer.controls.target, 'x').min(-10).max(10).step(0.1)
        .onChange(() => 
        {
            myViewer.controls.update()
            myViewer.render()
        })

        this.targetFolder.add(myViewer.controls.target, 'y').min(-10).max(10).step(0.1)
        .onChange(() => 
        {
            myViewer.controls.update()
            myViewer.render()
        })

        this.targetFolder.add(myViewer.controls.target, 'z').min(-10).max(10).step(0.1)
        .onChange(() => 
        {
            myViewer.controls.update()
            myViewer.render()
        })
    }

}

const debug = new Debug()
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
        // base
        this.scene = scene
        this.progress = 0

        // DOM
        this.loadingBarElement = document.querySelector('.loading-bar')
        this.loadingBarBgElement = document.querySelector('.loading-bar-bg')

        this.startBtn = document.querySelector('.start-btn')
        this.restartBtn = document.querySelector('.restart-btn')
        this.blurOverlay = document.querySelector('.blur-overlay')

        this.instructions = document.querySelector('.instructions')

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
            }, 2000)
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

    showRestartUI() 
    {
        this.blurOverlay.classList.remove('hidden')
        this.restartBtn.classList.remove('hidden')
    }

    hideRestartUI() 
    {
        this.blurOverlay.classList.add('hidden')
        this.restartBtn.classList.add('hidden')
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

        // mouse
        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()
        this.currentIntersect = null
        this.objectsToRaycaster = []

        window.addEventListener('click', () => 
        {
            // On vérifie que le jeu tourne et n'est pas bloqué
            if (this.storyManager && this.experienceStarted && !this.storyManager.locked) 
            {
                if (this.currentIntersect) 
                {
                    this.characterClick(this.currentIntersect.object)
                }
                else 
                {
                    this.characterInfos = document.querySelector('.character-infos')

                    if (this.characterInfos && !this.characterInfos.classList.contains('hidden')) 
                    {
                        this.characterInfos.classList.add('hidden')
                    }
                }
            }
        })

        // audio
        this.audioListener = null
        this.audioLoader = null
        this.ambienceSound = null

        // appel des instances
        this.setRenderer(options);
    }


    /**
     * Loading texture
     */
    async loadTexture() 
    {
        /**
         * texture des animations
         */
        this.bakedAnimationsTexture = await this.loader.loadTexture('/textures/animations/animations_baked.webp')
        this.bakedAnimationsTexture.flipY = false
        this.bakedAnimationsTexture.colorSpace = THREE.SRGBColorSpace

        this.bakedAnimationsMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedAnimationsTexture
            })


        /**
         * textures des personnages
         */
        this.bakedPersonnagesTexture = await this.loader.loadTexture('/textures/personnages/personnage_baked.webp')
        this.bakedPersonnagesTexture.flipY = false
        this.bakedPersonnagesTexture.colorSpace = THREE.SRGBColorSpace

        this.bakedPersonnagesMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedPersonnagesTexture
            })


        /**
         * texture outside
         */
        this.bakedOutside = await this.loader.loadTexture('/textures/outside/outside_baked.webp')
        this.bakedOutside.flipY = false
        this.bakedOutside.colorSpace = THREE.SRGBColorSpace

        this.bakedOutsideMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedOutside
            })


        /**
         * texture tree
         */
        this.bakedTree = await this.loader.loadTexture('/textures/tree/tree_baked.webp')
        this.bakedTree.flipY = false
        this.bakedTree.colorSpace = THREE.SRGBColorSpace

        this.bakedTreeMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedTree
            })


        /**
         * texture salon-droite
         */
        this.bakedSalonDroite = await this.loader.loadTexture('/textures/salon-droite/salon-droite_baked.webp')
        this.bakedSalonDroite.flipY = false
        this.bakedSalonDroite.colorSpace = THREE.SRGBColorSpace

        this.bakedSalonDroiteMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedSalonDroite
            })


        /**
         * texture salon-gauche
         */
        this.bakedSalonGauche = await this.loader.loadTexture('/textures/salon-gauche/salongauche_baking.webp')
        this.bakedSalonGauche.flipY = false
        this.bakedSalonGauche.colorSpace = THREE.SRGBColorSpace

        this.bakedSalonGaucheMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedSalonGauche
            })


        /**
         * texture salledebain-gauche
         */
        this.bakedSdbGauche = await this.loader.loadTexture('/textures/salledebain-gauche/douche_gauche_baked.webp')
        this.bakedSdbGauche.flipY = false
        this.bakedSdbGauche.colorSpace = THREE.SRGBColorSpace

        this.bakedSdbGaucheMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedSdbGauche
            })

        // evier
        this.bakedSdbGaucheEvier = await this.loader.loadTexture('/textures/salledebain-gauche/douche_gauche_evier_baked.webp')
        this.bakedSdbGaucheEvier.flipY = false
        this.bakedSdbGaucheEvier.colorSpace = THREE.SRGBColorSpace

        this.bakedSdbGaucheEvierMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedSdbGaucheEvier
            })

        // perso
        this.bakedSdbGauchePerso = await this.loader.loadTexture('/textures/salledebain-gauche/douche_gauche_perso_baked.webp')
        this.bakedSdbGauchePerso.flipY = false
        this.bakedSdbGauchePerso.colorSpace = THREE.SRGBColorSpace

        this.bakedSdbGauchePersoMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedSdbGauchePerso
            })


        /**
         * texture salledebain-droite
         */
        this.bakedSdbDroiteDouche = await this.loader.loadTexture('/textures/salledebain-droite/douche-salledebain-droite.webp')
        this.bakedSdbDroiteDouche.flipY = false
        this.bakedSdbDroiteDouche.colorSpace = THREE.SRGBColorSpace

        this.bakedSdbDroiteDoucheMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedSdbDroiteDouche
            })

        // evier
        this.bakedSdbDroiteEvier = await this.loader.loadTexture('/textures/salledebain-droite/evier-salledebain-droite.webp')
        this.bakedSdbDroiteEvier.flipY = false
        this.bakedSdbDroiteEvier.colorSpace = THREE.SRGBColorSpace

        this.bakedSdbDroiteEvierMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedSdbDroiteEvier
            })


        /**
         * texture gardemanger-gauche
         */
        // meuble 1
        this.bakedGmGaucheMeuble1 = await this.loader.loadTexture('/textures/gardemanger-gauche/gardem-gauche-meuble1-baked.webp')
        this.bakedGmGaucheMeuble1.flipY = false
        this.bakedGmGaucheMeuble1.colorSpace = THREE.SRGBColorSpace

        this.bakedGmGaucheMeuble1Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedGmGaucheMeuble1
            })

        // meuble 2
        this.bakedGmGaucheMeuble2 = await this.loader.loadTexture('/textures/gardemanger-gauche/gardem-gauche-meuble2-baked.webp')
        this.bakedGmGaucheMeuble2.flipY = false
        this.bakedGmGaucheMeuble2.colorSpace = THREE.SRGBColorSpace

        this.bakedGmGaucheMeuble2Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedGmGaucheMeuble2
            })

        // n1
        this.bakedGmGaucheN1 = await this.loader.loadTexture('/textures/gardemanger-gauche/gardem-gauche-n1-baked.webp')
        this.bakedGmGaucheN1.flipY = false
        this.bakedGmGaucheN1.colorSpace = THREE.SRGBColorSpace

        this.bakedGmGaucheN1Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedGmGaucheN1
            })

        // n2
        this.bakedGmGaucheN2 = await this.loader.loadTexture('/textures/gardemanger-gauche/gardem-gauche-n2-baked.webp')
        this.bakedGmGaucheN2.flipY = false
        this.bakedGmGaucheN2.colorSpace = THREE.SRGBColorSpace

        this.bakedGmGaucheN2Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedGmGaucheN2
            })


        /**
         * texture gardemanger-droite
         */
        // meuble 1
        this.bakedGmDroiteMeuble1 = await this.loader.loadTexture('/textures/gardemanger-droite/gardemanger-meuble1-droite-baked.webp')
        this.bakedGmDroiteMeuble1.flipY = false
        this.bakedGmDroiteMeuble1.colorSpace = THREE.SRGBColorSpace

        this.bakedGmDroiteMeuble1Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedGmDroiteMeuble1
            })
        // meuble 2
        this.bakedGmDroiteMeuble2 = await this.loader.loadTexture('/textures/gardemanger-droite/gardemanger-meuble2-droite-baked.webp')
        this.bakedGmDroiteMeuble2.flipY = false
        this.bakedGmDroiteMeuble2.colorSpace = THREE.SRGBColorSpace

        this.bakedGmDroiteMeuble2Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedGmDroiteMeuble2
            })
        // coffre
        this.bakedGmDroiteCoffre = await this.loader.loadTexture('/textures/gardemanger-droite/gardemanger-coffre-droite-baked.webp')
        this.bakedGmDroiteCoffre.flipY = false
        this.bakedGmDroiteCoffre.colorSpace = THREE.SRGBColorSpace

        this.bakedGmDroiteCoffreMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedGmDroiteCoffre
            })
        // table
        this.bakedGmDroiteTable = await this.loader.loadTexture('/textures/gardemanger-droite/gardemanger-droite-table-baked.webp')
        this.bakedGmDroiteTable.flipY = false
        this.bakedGmDroiteTable.colorSpace = THREE.SRGBColorSpace

        this.bakedGmDroiteTableMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedGmDroiteTable
            })


        /**
         * texture dortoir-gauche
         */
        // meuble
        this.bakedDortoirGaucheMeuble = await this.loader.loadTexture('/textures/dortoir-gauche/meubledort-gauche_baked.webp')
        this.bakedDortoirGaucheMeuble.flipY = false
        this.bakedDortoirGaucheMeuble.colorSpace = THREE.SRGBColorSpace

        this.bakedDortoirGaucheMeubleMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedDortoirGaucheMeuble
            })
        // hammac 1
        this.bakedDortoirGaucheHammac1 = await this.loader.loadTexture('/textures/dortoir-gauche/hammac1dort-gauche_baked.webp')
        this.bakedDortoirGaucheHammac1.flipY = false
        this.bakedDortoirGaucheHammac1.colorSpace = THREE.SRGBColorSpace

        this.bakedDortoirGaucheHammac1Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedDortoirGaucheHammac1
            })
        // hammac 2
        this.bakedDortoirGaucheHammac2 = await this.loader.loadTexture('/textures/dortoir-gauche/hammac2dort-gauche_baked.webp')
        this.bakedDortoirGaucheHammac2.flipY = false
        this.bakedDortoirGaucheHammac2.colorSpace = THREE.SRGBColorSpace

        this.bakedDortoirGaucheHammac2Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedDortoirGaucheHammac2
            })


        /**
         * texture dortoir-droite
         */
        // meuble
        this.bakedDortoirDroiteMeuble = await this.loader.loadTexture('/textures/dortoir-droite/dortoir-meuble-droite-baked.webp')
        this.bakedDortoirDroiteMeuble.flipY = false
        this.bakedDortoirDroiteMeuble.colorSpace = THREE.SRGBColorSpace

        this.bakedDortoirDroiteMeubleMaterial = new THREE.MeshStandardMaterial(
            {
                map: this.bakedDortoirDroiteMeuble
            })
        // hammac 1
        this.bakedDortoirDroiteHammac1 = await this.loader.loadTexture('/textures/dortoir-droite/hammac1-droite-dortoir-baked.webp')
        this.bakedDortoirDroiteHammac1.flipY = false
        this.bakedDortoirDroiteHammac1.colorSpace = THREE.SRGBColorSpace

        this.bakedDortoirDroiteHammac1Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedDortoirDroiteHammac1
            })
        // hammac 2
        this.bakedDortoirDroiteHammac2 = await this.loader.loadTexture('/textures/dortoir-droite/hammac2-droite-dortoir-baked.webp')
        this.bakedDortoirDroiteHammac2.flipY = false
        this.bakedDortoirDroiteHammac2.colorSpace = THREE.SRGBColorSpace

        this.bakedDortoirDroiteHammac2Material = new THREE.MeshStandardMaterial(
            {
                map: this.bakedDortoirDroiteHammac2
            })

    }


    /**
     * Loading model gltf
     */
    async loadModel() {
        /**
         * glb animations
         */
        this.animationsGltf = await this.loader.loadGLTF('/glb/animations/animations.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.animationsGltf.scene.traverse((child) => 
        {
            if (child.isMesh) {
                child.material = this.bakedAnimationsMaterial
            }
        })
        console.log('animations', this.animationsGltf)


        /**
         * glb personnages
         */
        this.personnagesGltf = await this.loader.loadGLTF('/glb/personnages/personnages.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.personnagesGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedPersonnagesMaterial

                if (child.name.includes('G1_SM_perso')) 
                {
                    this.objectsToRaycaster.push(child)
                }
            }
        })
        console.log('personnages', this.personnagesGltf)


        /**
         * glb outside
         */
        this.outsideGltf = await this.loader.loadGLTF('/glb/outside/outside.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.outsideGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedOutsideMaterial
            }
        })


        /**
         * glb tree
         */
        this.treeGltf = await this.loader.loadGLTF('/glb/tree/tree.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.treeGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedTreeMaterial
            }
        })


        /**
         * glb salon-droite
         */
        this.SalonDroiteGltf = await this.loader.loadGLTF('/glb/salon-droite/salon-droite.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.SalonDroiteGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedSalonDroiteMaterial
            }
        })


        /**
         * glb salon-gauche
         */
        this.SalonGaucheGltf = await this.loader.loadGLTF('/glb/salon-gauche/salon-gauche.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.SalonGaucheGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedSalonGaucheMaterial
            }
        })



        /**
         * glb salledebain-gauche
         */
        this.SdbGaucheGltf = await this.loader.loadGLTF('/glb/salledebain-gauche/douche-gauche.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.SdbGaucheGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedSdbGaucheMaterial
            }
        })

        // evier
        this.SdbGaucheEvierGltf = await this.loader.loadGLTF('/glb/salledebain-gauche/douche-gauche-evier.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.SdbGaucheEvierGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedSdbGaucheEvierMaterial
            }
        })

        // perso
        this.SdbGauchePersoGltf = await this.loader.loadGLTF('/glb/salledebain-gauche/douche-gauche-perso.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.SdbGauchePersoGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedSdbGauchePersoMaterial
            }
        })


        /**
         * glb salledebain-droite
         */
        this.SdbDroiteDoucheGltf = await this.loader.loadGLTF('/glb/salledebain-droite/douche-salledebain-droite.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.SdbDroiteDoucheGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedSdbDroiteDoucheMaterial
            }
        })

        // evier
        this.SdbDroiteEvierGltf = await this.loader.loadGLTF('/glb/salledebain-droite/evier-salledebain-droite.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.SdbDroiteEvierGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedSdbDroiteEvierMaterial
            }
        })


        /**
         * glb gardemanger-gauche
         */
        // meuble 1
        this.GmGaucheMeuble1Gltf = await this.loader.loadGLTF('/glb/gardemanger-gauche/gardem-gauche-meuble1.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.GmGaucheMeuble1Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedGmGaucheMeuble1Material
            }
        })

        // meuble 2
        this.GmGaucheMeuble2Gltf = await this.loader.loadGLTF('/glb/gardemanger-gauche/gardem-gauche-meuble2.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.GmGaucheMeuble2Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedGmGaucheMeuble2Material
            }
        })

        // n1
        this.GmGaucheN1Gltf = await this.loader.loadGLTF('/glb/gardemanger-gauche/gardem-gauche-n1.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.GmGaucheN1Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedGmGaucheN1Material
            }
        })

        // n2
        this.GmGaucheN2Gltf = await this.loader.loadGLTF('/glb/gardemanger-gauche/gardem-gauche-n2.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.GmGaucheN2Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedGmGaucheN2Material
            }
        })


        /**
         * glb gardemanger-droite
         */
        // meuble 1
        this.GmDroiteMeuble1Gltf = await this.loader.loadGLTF('/glb/gardemanger-droite/gardemanger-meuble1-droite.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.GmDroiteMeuble1Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedGmDroiteMeuble1Material
            }
        })
        // meuble 2
        this.GmDroiteMeuble2Gltf = await this.loader.loadGLTF('/glb/gardemanger-droite/gardemanger-meuble2-droite.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.GmDroiteMeuble2Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedGmDroiteMeuble2Material
            }
        })
        // coffre
        this.GmDroiteCoffreGltf = await this.loader.loadGLTF('/glb/gardemanger-droite/gardemanger-coffre-droite.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.GmDroiteCoffreGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedGmDroiteCoffreMaterial
            }
        })
        // table
        this.GmDroiteTableGltf = await this.loader.loadGLTF('/glb/gardemanger-droite/gardemanger-droite-table.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.GmDroiteTableGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedGmDroiteTableMaterial
            }
        })


        /**
         * glb dortoir-gauche
         */
        // meuble
        this.DortoirGaucheMeubleGltf = await this.loader.loadGLTF('/glb/dortoir-gauche/meubledort-gauche.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.DortoirGaucheMeubleGltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedDortoirGaucheMeubleMaterial
            }
        })
        // hammac 1
        this.DortoirGaucheHammac1Gltf = await this.loader.loadGLTF('/glb/dortoir-gauche/hammac1dort-gauche.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.DortoirGaucheHammac1Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedDortoirGaucheHammac1Material
            }
        })

        // hammac 2
        this.DortoirGaucheHammac2Gltf = await this.loader.loadGLTF('/glb/dortoir-gauche/hammac2dort-gauche.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.DortoirGaucheHammac2Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedDortoirGaucheHammac2Material
            }
        })


        /**
         * glb dortoir-gauche
         */
        // meuble
        this.DortoirDroiteMeubleGltf = await this.loader.loadGLTF('/glb/dortoir-droite/dortoir-meuble-droite.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.DortoirDroiteMeubleGltf.scene.traverse((child) => 
            {
            if (child.isMesh) 
            {
                child.material = this.bakedDortoirDroiteMeubleMaterial
            }
        })
        // hammac 1
        this.DortoirDroiteHammac1Gltf = await this.loader.loadGLTF('/glb/dortoir-droite/hammac1-droite-dortoir.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.DortoirDroiteHammac1Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedDortoirDroiteHammac1Material
            }
        })

        // hammac 2
        this.DortoirDroiteHammac2Gltf = await this.loader.loadGLTF('/glb/dortoir-droite/hammac2-droite-dortoir.glb')

        // appliquer bakeMaterial pour la texture sur tous les meshs
        this.DortoirDroiteHammac2Gltf.scene.traverse((child) => 
        {
            if (child.isMesh) 
            {
                child.material = this.bakedDortoirDroiteHammac2Material
            }
        })


        // Add la scène
        this.scene.add
            (
                this.animationsGltf.scene,
                this.personnagesGltf.scene,

                this.outsideGltf.scene,
                this.treeGltf.scene,

                this.SalonDroiteGltf.scene,
                this.SalonGaucheGltf.scene,

                this.SdbGaucheGltf.scene,
                this.SdbGaucheEvierGltf.scene,
                this.SdbGauchePersoGltf.scene,

                this.SdbDroiteDoucheGltf.scene,
                this.SdbDroiteEvierGltf.scene,

                this.GmGaucheMeuble1Gltf.scene,
                this.GmGaucheMeuble2Gltf.scene,
                this.GmGaucheN1Gltf.scene,
                this.GmGaucheN2Gltf.scene,

                this.GmDroiteMeuble1Gltf.scene,
                this.GmDroiteMeuble2Gltf.scene,
                this.GmDroiteCoffreGltf.scene,
                this.GmDroiteTableGltf.scene,

                this.DortoirGaucheMeubleGltf.scene,
                this.DortoirGaucheHammac1Gltf.scene,
                this.DortoirGaucheHammac2Gltf.scene,

                this.DortoirDroiteMeubleGltf.scene,
                this.DortoirDroiteHammac1Gltf.scene,
                this.DortoirDroiteHammac2Gltf.scene,

            )

        // prépare les clips
        this.mixer = new THREE.AnimationMixer(this.animationsGltf.scene)
        this.clips = this.animationsGltf.animations

        this.render()
    }


    /**
     * Mouse event
     */
    mouseEvent() {
        this.mouse = new THREE.Vector2();

        window.addEventListener('mousemove', (event) => 
        {
            this.mouse.x = (event.clientX / settings.sizes.w) * 2 - 1
            this.mouse.y = -(event.clientY / settings.sizes.h) * 2 + 1
        })
    }

    /**
     * Personnages DOM
     */
    characterClick(clickedMesh) 
    {
        this.characterInfos = document.querySelector('.character-infos')
        this.characterInfos.classList.remove('hidden')

        const allTexts = document.querySelectorAll('.character-text')
        allTexts.forEach((text) => 
        {
            text.classList.add('hidden')
        })


        if (clickedMesh.name.includes('perso_tom')) 
        {
            document.querySelector('.character-thomas').classList.remove('hidden')
        }

        else if (clickedMesh.name.includes('perso_julien')) 
        {
            document.querySelector('.character-julien').classList.remove('hidden')
        }

        else if (clickedMesh.name.includes('perso_melanie')) 
        {
            document.querySelector('.character-melanie').classList.remove('hidden')
        }

        else if (clickedMesh.name.includes('perso_arthur')) 
        {
            document.querySelector('.character-arthur').classList.remove('hidden')
        }

        else if (clickedMesh.name.includes('perso_anna')) 
        {
            document.querySelector('.character-anna').classList.remove('hidden')
        }

        else if (clickedMesh.name.includes('perso_carla')) 
        {
            document.querySelector('.character-carla').classList.remove('hidden')
        }

        else if (clickedMesh.name.includes('perso_samuel')) 
        {
            document.querySelector('.character-samuel').classList.remove('hidden')
        }
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

        // debug light
        /* const helper = new THREE.DirectionalLightHelper(this.directionalLight, 5);
        this.scene.add(helper); */

        // add à la scene
        this.scene.add(this.sunLight, this.directionalLight);

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
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.addEventListener('change', () => {
            this.render();
        });
        // dispo en debug
        this.controls.enabled = false

        // Recule notre camera pour qu'on puisse voir le centre de la scene
        // camera main
        this.camera.position.set(0, 0.5, 7.5) // x, y, z
        this.camera.lookAt(0, -1, -1.5) // x, y, z


        // Change une première fois la taille de notre canvas
        this.resize();


        // Appele les fonctions de chargement des éléments
        this.loadTexture()
        this.loadModel();
        this.loadGlobalAudio()

        this.mouseEvent()

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

                if (onComplete) onComplete()
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
        this.elapsedTime = this.clock.getElapsedTime()

      
        /** 
         * update du mixer/animations
         */
        if (this.mixer) 
        {
            this.mixer.update(this.delta)
        }


        /**
         * Raycaster
         */
        // place sur la cam
        this.raycaster.setFromCamera(this.mouse, this.camera)

        // raycast les objets de notre tableau
        const intersects = this.raycaster.intersectObjects(this.objectsToRaycaster)

        if (intersects.length && intersects[0].distance < 3) 
        {
            if (this.currentIntersect === null) 
            {
                // change le cursor to pointer
                document.body.style.cursor = 'pointer'
                console.log("survole de :", intersects[0].object.name)
            }
            this.currentIntersect = intersects[0]

            gsap.to(intersects[0].object.scale, 
            {
                x: 1.05, 
                y: 1.05,
                z: 1.05,
                duration: 0.3,
                ease: "power2.out"
            })
        }
        else {
            if (this.currentIntersect) 
            {
                // laisse le cursor default
                document.body.style.cursor = 'default'

                gsap.to(this.currentIntersect.object.scale, 
                {
                    x: 1, 
                    y: 1,
                    z: 1,
                    duration: 0.3,
                    ease: "power2.out"
                })
            }
            this.currentIntersect = null
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
        if (!this.gizmo) return

        this.scene.remove(this.gizmo);
        this.gizmo.dispose();
        this.gizmo = null;
        this.render();
    }


    addGizmo(size = 1) 
    {
        if (this.gizmo) return

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
        // base
        this.viewer = viewer
        this.viewer.storyManager = this
        this.dialogueBox = new DialogueBox()

        // initialisations
        this.locked = true
        this.currentScene = null

        // bouton toggle son/mute
        this.soundToggleBtn = document.querySelector('.button_toggle-sound')
        this.iconSong = this.soundToggleBtn.querySelector('.icon-song')
        this.iconMute = this.soundToggleBtn.querySelector('.icon-mute')
        this.continueBtn = document.querySelector('.button_right')

        this.intro = new Intro(viewer, this)
        this.scene1 = new Scene1(viewer, this)
        this.scene2 = new Scene2(viewer, this)
        this.scene3 = new Scene3(viewer, this)
        this.scene4 = new Scene4(viewer, this)
        this.outro = new Outro(viewer, this)

        this.scenes =
        {
            intro: this.intro,
            scene1: this.scene1,
            scene2: this.scene2,
            scene3: this.scene3,
            scene4: this.scene4,
            outro: this.outro
        }

        // appel des instances
        this.bindEvents()
    }


    /**
     * lancement de l'expérience
     * start-btn
     */
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

        // btn Start
        this.continueBtn.addEventListener('click', () => 
        {
            if (!this.viewer.experienceStarted) return
            if (this.locked) return
            this.currentScene?.interact?.()
        })

        // btn Song
        this.soundToggleBtn.addEventListener('click', () => 
        {
            const isMuted = this.soundToggleBtn.dataset.muted === 'true'
            if (isMuted) 
            {
                this.viewer.audioListener.setMasterVolume(1)
                this.soundToggleBtn.dataset.muted = 'false'
                this.iconMute.classList.add('hidden')
                this.iconSong.classList.remove('hidden')
            }
            else 
            {
                this.viewer.audioListener.setMasterVolume(0)
                this.soundToggleBtn.dataset.muted = 'true'
                this.iconSong.classList.add('hidden')
                this.iconMute.classList.remove('hidden')
            }
        })

        // btn Restart
        this.viewer.loader.restartBtn.addEventListener('click', () => 
        {
            this.viewer.loader.hideRestartUI()

            // reset toutes les animations
            this.viewer.mixer.stopAllAction()

            // cache le dialogue s'il est encore visible
            this.dialogueBox.hide()

            // relance l'intro
            this.goTo('intro')
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
        this.continueBtn.classList.add('hidden')
        this.viewer.loader.hideInstructions()
    }


    unlock() 
    {
        this.locked = false
        this.continueBtn.classList.remove('hidden')
    }

}



/**
 * INTRO CLASS
 */
class Intro {

    constructor(viewer, storyManager) 
    {
        // base
        this.viewer = viewer
        this.storyManager = storyManager

        this.clickBtnSound = new THREE.Audio(this.viewer.audioListener)
        this.voletSound = new THREE.Audio(this.viewer.audioListener)

        // appel des instances
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
        this.viewer.loader.showInstructions()

        if (this.clickBtnSound.buffer) 
        {
            this.clickBtnSound.play()
        }

        this.playOpenVolets()

        setTimeout(() => 
        {
            this.storyManager.unlock()
        }, 1000) // cd avant d'enabled les controls
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
        action1.timeScale = 1
        action1.setLoop(THREE.LoopOnce, 1)
        action1.clampWhenFinished = true
        action1.play()

        action2.reset()
        action2.timeScale = 1
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
        // base
        this.viewer = viewer
        this.storyManager = storyManager

        // initialisations
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
            }, 250)
        })
    }


    interact() {
        if (this.step === 0) 
        {

            this.storyManager.lock()
            this.step = 1

            this.storyManager.dialogueBox.show("G2: Oui ça ma juste blessé..")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 250)

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
            }, 250)

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
            }, 250)

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
        // base
        this.viewer = viewer
        this.storyManager = storyManager

        // initialisations
        this.step = 0

        // camera scène 2
        this.cameraPosition = new THREE.Vector3(-0.5, -0.7, 1.4)
        this.cameraTarget = new THREE.Vector3(2.4, -1, -2)
    }


    enter() {
        this.storyManager.lock()
        this.step = 0

        // camera scène 2
        this.viewer.moveCamera(this.cameraPosition, this.cameraTarget, 2, () => 
        {
            this.storyManager.dialogueBox.show("G1: Pourquoi tu as encore utilisé ma brosse à dents !!!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 250)

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
            }, 250)

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
            }, 250)

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
        // base
        this.viewer = viewer
        this.storyManager = storyManager

        // initialisations
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
            }, 250)
        })
    }


    interact() {
        if (this.step === 0) {
            this.storyManager.lock()
            this.step = 1

            this.storyManager.dialogueBox.show("G2: Honnêtement je ne sais pas, vraiment bizarre ce peuple..")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 250)

            return
        }

        if (this.step === 1) {
            this.storyManager.lock()
            this.step = 2

            this.storyManager.dialogueBox.show("P1: Mais aider-moi à descendre non ?!!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 250)

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
        // base
        this.viewer = viewer
        this.storyManager = storyManager

        // initialisations
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
            this.storyManager.dialogueBox.show("P1: Encore toi! C'est la troisième fois que tu voles notre bouffe!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 250)
        })
    }


    interact() 
    {
        if (this.step === 0) 
        {

            this.storyManager.lock()
            this.step = 1

            this.storyManager.dialogueBox.show("G1: Quoi? C'était juste un petit morceau.")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 250)

            return

        }

        if (this.step === 1) 
        {
            this.storyManager.lock()
            this.step = 2

            this.storyManager.dialogueBox.show("P1: Un petit morceau! T'as bouffé la moitié de nos gâteaux!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 250)

            return
        }

        if (this.step === 2) 
        {
            this.storyManager.lock()
            this.step = 3

            this.storyManager.dialogueBox.show("P2: La prochaine fois qu'on te chope, on te transforme en cuisses de grenouille !!!!")
            setTimeout(() => 
            {
                this.storyManager.unlock()
            }, 250)

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
        // base
        this.viewer = viewer
        this.storyManager = storyManager

        // initialisations
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

        // affiche le bouton recommencer après la fermeture des volets
        const voletDuration = Math.max(volet0.duration, volet1.duration)
        setTimeout(() => 
        {
            this.storyManager.viewer.loader.showRestartUI()
        }, voletDuration * 1000)

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
        if (this.debugActive) 
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
                if (value) 
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
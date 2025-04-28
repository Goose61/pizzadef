export class AssetManager {
    private images: Map<string, HTMLImageElement> = new Map();
    private assetsToLoad: { name: string, src: string }[] = [];

    queueImage(name: string, src: string): void {
        this.assetsToLoad.push({ name, src });
    }

    loadAll(): Promise<void[]> {
        const promises: Promise<void>[] = [];
        console.log('Loading assets...');

        this.assetsToLoad.forEach(({ name, src }) => {
            const promise = new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    console.log(`Loaded asset: ${name} from ${src}`);
                    this.images.set(name, img);
                    console.log(`>>> AssetManager: Set image for key "${name}". Map size: ${this.images.size}`);
                    resolve();
                };
                img.onerror = (err) => {
                    console.error(`Failed to load asset: ${name} from ${src}`, err);
                    reject(new Error(`Failed to load asset: ${name}`));
                };
                img.src = src;
            });
            promises.push(promise);
        });

        this.assetsToLoad = [];

        return Promise.all(promises);
    }

    getImage(name: string): HTMLImageElement | undefined {
        const hasImage = this.images.has(name);
        console.log(`>>> AssetManager: getImage called for key "${name}". Found: ${hasImage}. Map size: ${this.images.size}`);
        
        const img = this.images.get(name);
        if (!img) {
             console.warn(`Image "${name}" not found in AssetManager. Was it loaded?`);
        }
        return img;
    }
} 
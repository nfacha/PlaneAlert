import axios from "axios";

export class PlaneSpotterUtils {
    public static async getPhotoUrl(icao: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            let photoUrl = null;
            axios.get('https://api.planespotters.net/pub/photos/hex/' + icao).then(photoData => {
                if (photoData.status === 200 && photoData.data.photos.length > 0) {
                    photoUrl = photoData.data.photos[0].thumbnail_large.src
                    resolve(photoUrl);
                }
                resolve(null);
            });
        });
    }
}

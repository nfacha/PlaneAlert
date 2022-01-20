export class GeoUtils {
    public static distanceBetweenCoordinates(lat1: number, lon1: number, lat2: number, lon2: number) {
        let R = 6371; // km
        let dLat = GeoUtils.toRad(lat2 - lat1);
        let dLon = GeoUtils.toRad(lon2 - lon1);
        lat1 = GeoUtils.toRad(lat1);
        lat2 = GeoUtils.toRad(lat2);

        let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private static toRad(value: number): number {
        return value * Math.PI / 180;
    }

}

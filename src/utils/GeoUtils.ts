import {PlaneAlert} from "../index";
import {Aircraft} from "../models/Aircraft";
import {AircraftMeta} from "../models/Airline";

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

    public static findNearestAirport(aircraft: Aircraft | AircraftMeta, allowedAirports?: string[]) {
        if (aircraft.meta.lon === null || aircraft.meta.lat === null || PlaneAlert.airports === null) {
            return null;
        }
        PlaneAlert.log.debug(`Plane ${this.name} (${aircraft.icao}) searching for nearest airport of ${aircraft.meta.lat}/${aircraft.meta.lon}`);
        let min_distance = Number.MAX_SAFE_INTEGER;
        let nearest_airport = null;
        for (const airport of PlaneAlert.airports) {
            if (airport.type === 'closed') {
                continue;
            }
            if (aircraft instanceof Aircraft) {
                // We don't have supported airport types for aircraft we don't know beforehand
                // Maybe in the future this can come form the API itself
                if (aircraft.allowedAirports.indexOf(airport.type) === -1) {
                    continue;
                }
            } else {
                if (allowedAirports !== undefined && allowedAirports.indexOf(airport.type) === -1) {
                    continue;
                }
            }

            const distance = GeoUtils.distanceBetweenCoordinates(aircraft.meta.lat, aircraft.meta.lon, airport.latitude_deg, airport.longitude_deg);
            if (distance < min_distance) {
                min_distance = distance;
                nearest_airport = airport;
            }
        }
        return {
            airport: nearest_airport,
            distance: min_distance
        };
    }

}

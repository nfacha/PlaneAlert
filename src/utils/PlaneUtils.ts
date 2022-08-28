export class PlaneUtils {
    public static isEmergencySquawk(squawk: number | null): boolean {
        squawk = Number(squawk);
        if (squawk === null) {
            return false;
        }
        return [7500, 7600, 7700, 5053].includes(squawk)
    }

    public static getEmergencyType(squawk: number | null): string {
        switch (squawk) {
            case 7500:
                return 'Hijack';
            case 7600:
                return 'Radio Failure';
            case 7700:
                return 'General Emergency';
            default:
                return '';

        }
    }
}

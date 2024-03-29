export class PlaneUtils {
    public static isEmergencySquawk(squawk: number | null): boolean {
        squawk = Number(squawk);
        if (squawk === null) {
            return false;
        }
        return [7500, 7600, 7700].includes(squawk)
    }

    public static getEmergencyType(squawk: number | null): string {
        squawk = Number(squawk);

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

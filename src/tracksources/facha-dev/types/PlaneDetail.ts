export interface PlaneDetail {
    icao?: string;
    registration?: string;
    type?: {
        code?: string;
        manufacturer?: string;
        yearBuilt?: number;
        serial?: string;
        description?: string;
    },
    country?: string;
    operator?: {
        name?: string;
        icao?: string;
    },
    military?: boolean;
}

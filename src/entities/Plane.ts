import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {PlaneAlert} from "../PlaneAlert";
import {PlaneEvents} from "../PlaneEvents";

@Entity()
export class Plane extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: "varchar", length: 255})
    name!: string;

    @Column({type: "varchar", length: 255})
    icao!: string;

    @Column({type: "varchar", length: 255})
    registration!: string;

    @Column({type: "boolean", default: true})
    active!: boolean;

    @Column({type: "integer", default: 1800})
    refresh_interval!: number;

    @Column({type: "timestamp", nullable: true})
    last_refresh!: string;

    @Column({type: "timestamp", nullable: true})
    next_refresh!: string;

    @Column({type: "timestamp", nullable: true})
    last_seen!: string;

    @Column({type: "boolean", default: true})
    on_ground!: boolean;
    ////////////////////////////////////////////////////////////////

    public async update(){
        const data = await PlaneAlert.trackSource?.getPlaneStatus(this.icao);
        if(data === undefined){
            return;
        }
        if(data === null){
            PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) detected as landed thru DATA-LOSS landing`);
            this.on_ground = true;
            this.triggerEvent(PlaneEvents.PLANE_LAND, null);
            return;
        }
        if(!this.on_ground && data.onGround){
            PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) detected as landed thru ON-GROUND landing`);
            this.on_ground = true;
            this.triggerEvent(PlaneEvents.PLANE_LAND, null);
            return;
        }
        if(this.on_ground && !data.onGround){
            PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) detected as airborne thru ON-GROUND takeoff`);
            this.on_ground = false;
            this.triggerEvent(PlaneEvents.PLANE_TAKEOFF, null);
            return;
        }
    }

    private triggerEvent(event: PlaneEvents, data: any){
        PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) trigered  ${event}`);
    }
}

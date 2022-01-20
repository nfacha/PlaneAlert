import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {PlaneAlert} from "../PlaneAlert";

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

    public update(){
        PlaneAlert.trackSource?.getPlaneStatus(this.icao);
    }
}

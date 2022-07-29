import {BaseEntity, Column, Entity, JoinColumn, PrimaryGeneratedColumn} from "typeorm";
import {Plane} from "./Plane";

@Entity()
export class TrackHistory extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;
    @Column({type: "integer"})
    plane_id!: number;
    @Column({type: "varchar", length: 255, nullable: true})
    callsign!: string | null;
    @Column({type: "timestamp", nullable: true})
    timestamp!: Date;
    @Column({type: "float", nullable: true})
    longitude!: number | null;
    @Column({type: "float", nullable: true})
    latitude!: number | null;
    @Column({type: "float", nullable: true})
    barometricAltitude!: number | null;
    @Column({type: "boolean", nullable: true})
    onGround!: boolean | null;
    @Column({type: "float", nullable: true})
    velocity!: number | null;
    @Column({type: "float", nullable: true})
    verticalRate!: string | null;
    @Column({type: "varchar", length: 10, nullable: true})
    squawk!: string | null;
    @JoinColumn({name: 'plane_id'})
    plane!: Plane;
}

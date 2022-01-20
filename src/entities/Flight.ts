import {BaseEntity, Column, Entity, JoinColumn, PrimaryGeneratedColumn} from "typeorm";
import {Plane} from "./Plane";

@Entity()
export class Flight extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;
    @Column({type: "integer"})
    plane_id!: number;
    @Column({type: "varchar", length: 255, nullable: true})
    callsign!: string | null;
    @Column({type: "timestamp", nullable: true})
    departure_time!: Date;
    @Column({type: "timestamp", nullable: true})
    arrival_time!: Date;
    @Column({type: "varchar", length: 255, nullable: true})
    departure_airport!: string | null;
    @Column({type: "varchar", length: 255, nullable: true})
    arrival_airport!: string | null;
    @Column({type: "integer", nullable: true})
    squawk!: number | null;
    @JoinColumn({name: 'plane_id'})
    plane!: Plane;
}

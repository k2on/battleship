import { z } from "zod";

export const CoordinateValidator = z.tuple([z.int(), z.int()]);
export const CoordinatesValidator = z.array(CoordinateValidator);

export type Coordinates = z.infer<typeof CoordinatesValidator>;

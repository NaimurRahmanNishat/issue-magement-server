// src/middleware/validate.middleware.ts
import { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject } from 'zod';
import { catchAsync } from "./catchAsync";
import { createError } from "../utils/errorHandler";

export const validate = (schema: ZodObject<any, any>) => catchAsync(async (req: Request , res: Response , next: NextFunction) => {

    const dataToValidate: {[key: string] : any} = {};

    /*
      const dataToValidate= {
       params: 12345
      }
    */

    if(schema.shape.body) dataToValidate.body = req.body;
    if(schema.shape.params) dataToValidate.params = req.params;
    if(schema.shape.query) {
        if(req.query && Object.keys(req.query).length){
            dataToValidate.query = req.query
        }
    };

    if(schema.shape.cookies) dataToValidate.cookies = req.cookies;

    try {
        
        const validatedData = await schema.parseAsync(dataToValidate);

        if(validatedData.body) req.body = validatedData.body;
        if(validatedData.params) req.params = validatedData.params as any;
         if(validatedData.query) req.query = validatedData.query as any;

        next()
    } catch (error: any) {
        if( error instanceof ZodError) {
            const errorMessage = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

            throw createError(400, `Validation Faild: ${errorMessage.join(', ')}`);
        }

        throw createError(500, "Validation failed due to an unexpected server error")
    }


})
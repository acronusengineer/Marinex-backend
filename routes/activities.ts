import { Request, ResponseToolkit } from "@hapi/hapi";
import process from "process";

import {
  getProjectSchema,
} from "../validation/project";
import User from "../models/users";
import Investment from "../models/investments";
import Project from "../models/projects";

import {
  getAllProjectSwagger,
} from "../swagger/project";

import {
  createNewProject,
  createNewTrading,
} from "../utils/blockchain/manager";
import WithDraw from "../models/withdraw";
import Activity from "../models/activities";

const options = { abortEarly: false, stripUnknown: true };

export let activityRoute = [
  {
    method: "GET",
    path: "/",
    config: {
      description: "Get all project with filter",
      auth: "jwt",
      plugins: getAllProjectSwagger,
      tags: ["api", "project"],
      validate: {
        // query: getProjectSchema,
        options,
        failAction: (request, h, error) => {
          const details = error.details.map((d) => {
            return {
              message: d.message,
              path: d.path,
            };
          });
          return h.response(details).code(400).takeover();
        },
      },
      handler: async (request: Request, response: ResponseToolkit) => {
        const user = await User.findById(request.auth.credentials.userId);
        const commonPipeline = [

          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "createdBy",
            },
          },
          {
            $unwind: "$createdBy",
          },
          {
            $project: {
              _id: 1,
              title: 1,
              createdAt: 1,
              type: 1,
              "createdBy.role": 1,
              "createdBy._id": 1,
              "createdBy.firstName": 1,
              "createdBy.lastName": 1,
            }
          },
          {
            $sort: {
              createdAt: -1
            }
          },
          {
            $limit: 20
          }
        ];

        // Role-specific conditions
        let rolePipeline;
        if (user.role === 'admin') {
          rolePipeline = [{
            $match: { to: 'admin' }
          }, ...commonPipeline];
        } else if (user.role === 'prowner') {
          rolePipeline = [{
            $match: {
              $or: [
                { to: 'prowner' },
                { direct: user._id }
              ]
            }
          }, ...commonPipeline];
        }
        console.log('Activities Query----->', rolePipeline);

        // Execute the aggregation pipeline
        const activities = await Activity.aggregate(rolePipeline);
        console.log('Activities Result----->', activities);
        return {
          data: activities,
        };
      },
    },
  }
  // {
  //   method: "POST",
  //   path: "/claim",
  //   config: {
  //     description: "claim on my project",
  //     auth: "jwt",
  //     plugins: claimProjectSwagger,
  //     tags: ["api", "project"],
  //     validate: {
  //       payload: claimProjectSchema,
  //       options,
  //       failAction: (request, h, error) => {
  //         const details = error.details.map((d) => {
  //           return {
  //             message: d.message,
  //             path: d.path,
  //           };
  //         });
  //         return h.response(details).code(400).takeover();
  //       },
  //     },
  //     handler: async (request: Request, response: ResponseToolkit) => {
  //       const user = await User.findById(request.auth.credentials.userId);

  //       if (user.role === "investor") {
  //         const result = await claim(
  //           request.payload["projectId"],
  //           user.wallet.id,
  //           user.wallet.address
  //         );
  //         if (result === true) {
  //           return response.response({ msg: "Claimed successfully" });
  //         }
  //         return response.response({ msg: "Claimed failed" }).code(400);
  //       }

  //       return response.response({ msg: "No permission" }).code(403);
  //     },
  //   },
  // },

];

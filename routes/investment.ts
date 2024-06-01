import { Request, ResponseToolkit } from "@hapi/hapi";
import Investment from "../models/investments";
import User from "../models/users";
import Project from "../models/projects";
import Activity from "../models/activities";
import {
  getBalance,
  getClaimableAmount,
  getClaimedRewards,
  getFundraising,
  getGivenRewards,
  getAssets,
  invest,
} from "../utils/blockchain/project";

import { investSchema, getInvestmentSchema, getStatisticsSchema } from "../validation/investment";

import { investSwagger, getInvestmentSwagger } from "../swagger/investment";

const options = { abortEarly: false, stripUnknown: true };
export let investmentRoute = [
  {
    method: "POST",
    path: "/",
    options: {
      auth: "jwt",
      description: "Investment on project",
      plugins: investSwagger,
      tags: ["api", "user"],
      validate: {
        payload: investSchema,
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
    },
    handler: async (request: Request, response: ResponseToolkit) => {
      try {
        const payload = {
          userId: request.auth.credentials.userId,
          projectId: request.payload["projectId"],
          amount: request.payload["amount"],
        };
        console.log("----investment here----");
        const user = await User.findById(payload.userId);

        const investResult = await invest(
          payload.projectId,
          user.wallet.id,
          user.wallet.address,
          payload.amount
        );

        if (investResult) {
          console.log("investment payload -->", payload);
          console.log("investment result -->", investResult);

          const project = await Investment.findOne({
            userId: payload.userId,
            projectId: payload.projectId,
          });
          const investedProject = await Project.findById(payload.projectId);
          if (project) {
            project.amount += payload.amount;
            await project.save();
            // ------- Create Activities ----------//
            const newActivity = new Activity({
              title: "New Investment Created",
              createdBy: user._id,
              content: project._id,
              type: "investment",
              direct: [investedProject.projectOwner],
            })
            await newActivity.save();

          } else {
            const newInvest = new Investment(payload);
            await newInvest.save();
            // ------- Create Activities ----------//
            const newActivity = new Activity({
              title: "New Investment Created",
              createdBy: user._id,
              content: newInvest._id,
              type: "investment",
              direct: [investedProject.projectOwner],
            })
            await newActivity.save();
          }

          return response.response({ msg: "Invest success" }).code(201);
        } else {
          return response.response({ msg: "Invest failed." }).code(400);
        }
      } catch (error) {
        console.log(error);
        return response.response({ msg: "Invest failed" }).code(500);
      }
    },
  },
  {
    method: "GET",
    path: "/",
    options: {
      auth: "jwt",
      description:
        "Get investment with pagination, userId, projectId, status, page",
      plugins: getInvestmentSwagger,
      tags: ["api", "kyc"],
      validate: {
        query: getInvestmentSchema,
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
        const userId = request.auth.credentials.userId;
        const user = await User.findById(userId);
        var totalAmount = 0;
        var totalClaimed = 0;
        var totalClaimable = 0;

        if (user.role === "investor") {
          const projectIds = await Project.find({});
          const investorAddress = user.wallet.address;
          const result: any[] = [];
          for (let i = 0; i < projectIds.length; i++) {
            const row = projectIds[i];

            if (row.allowance !== 1) continue;

            const shares = await getBalance(
              row._id.toString(),
              investorAddress
            );
            if (Number(shares) === 0) continue;

            const amount = await getAssets(row._id.toString(), investorAddress);
            if (Number(amount) === 0) continue;

            const claimed = await getClaimedRewards(
              row._id.toString(),
              investorAddress
            );

            const claimable = await getClaimableAmount(
              row._id.toString(),
              investorAddress
            );

            totalAmount += Number(amount);
            totalClaimed += Number(claimed);
            totalClaimable += Number(claimable);

            console.log("shares------------>", shares);
            result.push({
              project: row,
              amount,
              price:
                row.tokenization.assetValue / row.tokenization.tonnage / 1000,
              claimedRewards: claimed,
              claimableRewards: claimable,
            });
          }

          return {
            total: {
              investment: totalAmount,
              claimed: totalClaimed,
              claimable: totalClaimable,
            },
            data: result,
          };
        }
        if (user.role === "prowner") {
          const projectIds = await Project.find({ projectOwner: userId });
          var totalFundraising = 0;
          var totalRewards = 0;
          const result: any[] = [];

          for (let i = 0; i < projectIds.length; i++) {
            const project = projectIds[i];

            const fundraising = await getFundraising(project._id.toString());
            const givenRewards = await getGivenRewards(project._id.toString());

            totalFundraising += Number(fundraising);
            totalRewards += Number(givenRewards);

            result.push({
              project,
              fundraising,
              givenRewards,
            });
          }

          return {
            data: result,
            total: { fundraising: totalFundraising, rewards: totalRewards },
          };
        }
        return response
          .response({ msg: "You have no permission to access." })
          .code(403);
      },
    },
  },
  {
    method: "GET",
    path: "/asset-trends",
    options: {
      auth: "jwt",
      description:
        "Get investments count of graph",
      plugins: getInvestmentSwagger,
      tags: ["api", "kyc"],
      validate: {
        query: getInvestmentSchema,
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
        const userId = request.auth.credentials.userId;
        const user = await User.findById(userId);

        console.log('Asset Trends Api------>', userId)
        if (user.role === "investor") {
          const year = await Investment.aggregate([
            {
              $match: {
                userId: user._id
              }
            },
            {
              $sort: {
                createdAt: -1
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                },
                count: { $sum: '$amount' }
              }
            },
            {
              $project: {
                _id: 0,
                label: '$_id.year',
                count: 1
              }
            }
          ]);
          const month = await Investment.aggregate([
            {
              $match: {
                userId: user._id
              }
            },
            {
              $sort: {
                createdAt: -1
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                },
                count: { $sum: '$amount' }
              }
            },
            {
              $project: {
                _id: 0,
                label: {
                  $concat: [
                    { $toString: '$_id.year' },
                    '-',
                    { $toString: '$_id.month' }
                  ],
                },
                count: 1
              }
            }
          ]);
          const week = await Investment.aggregate([
            {
              $match: {
                userId: user._id
              }
            },
            {
              $sort: {
                createdAt: -1
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                  week: { $week: '$createdAt' }
                },
                count: { $sum: '$amount' }
              }
            },
            {
              $project: {
                _id: 0,
                label: {
                  $concat: [
                    { $toString: '$_id.year' },
                    '-',
                    { $toString: '$_id.week' }
                  ],
                },
                count: 1
              }
            }
          ]);
          console.log('Result Data------>', {
            year: year,
            month: month,
            week: week
          })
          return {
            year: year,
            month: month,
            week: week
          };
        }
        // if (user.role === "prowner") {


        //   return {
        //     data: result,
        //     total: { fundraising: totalFundraising, rewards: totalRewards },
        //   };
        // }
        return response
          .response({ msg: "You have no permission to access." })
          .code(403);
      },
    },
  },
  {
    method: "GET",
    path: "/statistics",
    options: {
      auth: "jwt",
      description:
        "Get statistics with type(projects, proejcts owners and investors)",
      plugins: getInvestmentSwagger,
      tags: ["api", "statistics"],
      validate: {
        query: getStatisticsSchema,
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
        const { type } = request.query;
        const userId = request.auth.credentials.userId;
        const user = await User.findById(userId);
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        try {

          if (user.role === "prowner") {
            if (type == 0) {
              const projectIds = await Project.aggregate([
                {
                  $match: {
                    projectOwner: user._id
                  }
                },
                {
                  $project: {
                    _id: 1
                  }
                }
              ]);
              const projectIdsArray = await Promise.all(projectIds.map(async (project) => {
                return project._id;
              }));
              const year = await Investment.aggregate([
                {
                  $match: {
                    $and: [
                      {
                        $expr:
                          { $eq: [{ $year: '$createdAt' }, currentYear] },
                      },
                      {
                        projectId: { $in: projectIdsArray }
                      }
                    ]
                  }
                },
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: '$_id.month',
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);


              const month = await Investment.aggregate([
                {
                  $match: {
                    $and: [
                      {
                        $expr:
                          { $eq: [{ $year: '$createdAt' }, currentYear] },
                      },
                      {
                        $expr:
                          { $eq: [{ $month: '$createdAt' }, currentMonth] },
                      },
                      {
                        projectId: { $in: projectIdsArray }
                      }
                    ]
                  }
                },
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                      dayOfMonth: { $dayOfMonth: '$createdAt' },
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: {
                      $concat: [
                        { $toString: '$_id.dayOfMonth' }
                      ]
                    },
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);

              return {
                year: year,
                month: month
              };
            } else {
              const year = await Project.aggregate([
                {
                  $match: {
                    $and: [
                      { $expr: { $eq: [{ $year: '$createdAt' }, currentYear] } },
                    ]
                  }
                },
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: '$_id.month',
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);

              const month = await Project.aggregate([
                {
                  $match: {
                    $and: [
                      {
                        $expr: {
                          $and: [
                            { $eq: [{ $year: '$createdAt' }, currentYear] },
                            { $eq: [{ $month: '$createdAt' }, currentMonth] }
                          ]
                        }
                      },
                    ]
                  }
                },

                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                      dayOfMonth: { $dayOfMonth: '$createdAt' },
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: {
                      $concat: [
                        { $toString: '$_id.dayOfMonth' }
                      ]
                    },
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);
              return {
                year: year,
                month: month
              };
            }
          } else if (user.role === "admin") {
            if (type == 0) {
              const year = await User.aggregate([
                {
                  $match: {
                    $and: [
                      { $expr: { $eq: [{ $year: '$createdAt' }, currentYear] } },
                      { role: "investor" }
                    ]
                  }
                },
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: '$_id.month',
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);

              const month = await User.aggregate([
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: [{ $year: '$createdAt' }, currentYear] },
                        { $eq: [{ $month: '$createdAt' }, currentMonth] }
                      ]
                    },
                    role: "investor"
                  }
                },
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                      dayOfMonth: { $dayOfMonth: '$createdAt' },
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: {
                      $concat: [
                        { $toString: '$_id.dayOfMonth' }
                      ]
                    },
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);
              return {
                year: year,
                month: month
              };
            } else if (type == 2) {

              const year = await User.aggregate([
                {
                  $match: {
                    $and: [
                      { $expr: { $eq: [{ $year: '$createdAt' }, currentYear] } },
                      { role: "prowner" }
                    ]
                  }
                },
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: '$_id.month',
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);

              const month = await User.aggregate([
                {
                  $match: {
                    $and: [
                      {
                        $expr: {
                          $and: [
                            { $eq: [{ $year: '$createdAt' }, currentYear] },
                            { $eq: [{ $month: '$createdAt' }, currentMonth] }
                          ]
                        }
                      },
                      { role: "prowner" }
                    ]
                  }
                },
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },     // Include year in the grouping
                      month: { $month: '$createdAt' }, // Include month in the grouping
                      dayOfMonth: { dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: {
                      $concat: [
                        { $toString: '$_id.dayOfMonth' }
                      ],
                    },
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);
              return {
                year: year,
                month: month
              };
            } else if (type == 1) {
              const year = await Project.aggregate([
                {
                  $match: {
                    $expr: { $eq: [{ $year: '$createdAt' }, currentYear] }
                  }
                },
                {
                  $sort: {
                    createdAt: -1
                  }
                },
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: '$_id.month',
                    count: 1
                  }
                }
              ]);

              const month = await Project.aggregate([
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: [{ $year: '$createdAt' }, currentYear] },
                        { $eq: [{ $month: '$createdAt' }, currentMonth] }
                      ]
                    }
                  }
                },
                {
                  $group: {
                    _id: {
                      day: { dayOfMonth: '$createdAt' },
                      month: { $month: '$createdAt' }, // Include month in the grouping
                      year: { $year: '$createdAt' }     // Include year in the grouping

                    },
                    count: { $sum: 1 }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    label: {
                      $concat: [
                        { $toString: '$_id.month' }
                      ],
                    },
                    count: 1
                  }
                },
                {
                  $sort: {
                    label: 1
                  }
                },
              ]);
              return {
                year: year,
                month: month
              };
            }
          }
        } catch (err) {
          console.log('statistics err------>', err)
        }
        return response
          .response({ msg: "You have no permission to access." })
          .code(403);
      },
    },
  },
];

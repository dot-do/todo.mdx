"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Line, XAxis, YAxis, ComposedChart } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card"

export interface VelocityDataPoint {
  week: string
  period: string
  closed: number
  average: number
}

export interface VelocityChartProps {
  data?: VelocityDataPoint[]
  title?: string
  description?: string
}

const chartConfig = {
  closed: {
    label: "Issues Closed",
    color: "hsl(var(--chart-1, 220 70% 50%))",
  },
  average: {
    label: "Rolling Average",
    color: "hsl(var(--chart-3, 340 75% 55%))",
  },
} satisfies ChartConfig

// Generate sample velocity data for the last 8 weeks
function generateSampleData(): VelocityDataPoint[] {
  const data: VelocityDataPoint[] = []
  const weeks = [
    { week: "W45", period: "Nov 4-8", closed: 8 },
    { week: "W46", period: "Nov 11-15", closed: 12 },
    { week: "W47", period: "Nov 18-22", closed: 10 },
    { week: "W48", period: "Nov 25-29", closed: 15 },
    { week: "W49", period: "Dec 2-6", closed: 13 },
    { week: "W50", period: "Dec 9-13", closed: 14 },
    { week: "W51", period: "Dec 16-20", closed: 11 },
    { week: "W52", period: "Dec 23-27", closed: 9 },
  ]

  weeks.forEach((week, index) => {
    // Calculate rolling average (last 3 weeks)
    let average = 0
    if (index >= 2) {
      const last3Weeks = weeks.slice(index - 2, index + 1)
      average = Math.round(
        last3Weeks.reduce((sum, w) => sum + w.closed, 0) / 3
      )
    } else {
      average = Math.round(
        weeks.slice(0, index + 1).reduce((sum, w) => sum + w.closed, 0) / (index + 1)
      )
    }

    data.push({
      week: week.week,
      period: week.period,
      closed: week.closed,
      average,
    })
  })

  return data
}

export function VelocityChart({
  data = generateSampleData(),
  title = "Team Velocity",
  description = "Issues closed per week with rolling average",
}: VelocityChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ComposedChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              label={{ value: "Issues Closed", angle: -90, position: "insideLeft" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="closed"
              fill="var(--color-closed)"
              radius={[4, 4, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="average"
              stroke="var(--color-average)"
              strokeWidth={2}
              dot={{
                fill: "var(--color-average)",
                r: 4,
              }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

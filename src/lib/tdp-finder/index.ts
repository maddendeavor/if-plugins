import {ModelPluginInterface} from '../../interfaces';
import {KeyValuePair} from '../../types/common';
import * as fs from 'fs';
import * as path from 'path';

export class TdpFinderModel implements ModelPluginInterface {
  authParams: object | undefined = undefined;
  staticParams: object | undefined;
  name: string | undefined;
  data: any;

  authenticate(authParams: object): void {
    this.authParams = authParams;
  }

  /**
   * Calculate the total emissions for a list of inputs.
   *
   * Each Input require:
   * @param {Object[]} inputs
   * @param {string} inputs[].timestamp RFC3339 timestamp string
   */
  async execute(inputs: object | object[] | undefined): Promise<any[]> {
    if (inputs === undefined) {
      throw new Error('Required Parameters not provided');
    } else if (!Array.isArray(inputs)) {
      throw new Error('Inputs must be an array');
    }

    return inputs.map((input: KeyValuePair) => {
      input['thermal-design-power'] = 0;
      if ('physical-processor' in input) {
        const physicalProcessors = input['physical-processor'] as string;
        physicalProcessors.split(',').forEach(physicalProcessor => {
          physicalProcessor = physicalProcessor.trim();
          if (
            physicalProcessor in this.data &&
            input['thermal-design-power'] < this.data[physicalProcessor]
          ) {
            input['thermal-design-power'] = this.data[physicalProcessor];
          } else if (!(physicalProcessor in this.data)) {
            throw new Error(
              `physical-processor ${physicalProcessor} not found in database. Please check spelling / contribute to IEF with the data.`
            );
          }
        });
      } else {
        throw new Error('physical-processor not provided');
      }
      return input;
    });
  }

  async configure(
    staticParams: object | undefined
  ): Promise<ModelPluginInterface> {
    this.staticParams = staticParams;
    this.data = await this.loadData();
    return this;
  }

  async loadData(): Promise<any> {
    const data: KeyValuePair = {};
    // read data.csv and read lines into memory
    const result = fs.readFileSync(path.join(__dirname, 'data.csv'), 'utf8');
    for (const line of result.split('\n')) {
      const [name_w_at, tdp_r] = line.split(',');
      const name = name_w_at.split('@')[0].trim();
      const tdp = parseFloat(tdp_r.replace('\r', ''));
      data[name] = tdp;
    }
    const result2 = fs.readFileSync(path.join(__dirname, 'data2.csv'), 'utf8');
    for (const line of result2.split('\n')) {
      const [name_w_at, tdp_r] = line.split(',');
      if (name_w_at === '') {
        continue;
      }
      const name = name_w_at.split('@')[0].trim();
      const tdp = parseFloat(tdp_r.replace('\r', ''));
      if (!(name in data) || data[name] < tdp) {
        data[name] = tdp;
      }
    }
    const result3 = fs.readFileSync(
      path.join(__dirname, 'boavizta_data.csv'),
      'utf8'
    );
    for (const line of result3.split('\n')) {
      const [name_w_at, tdp_r] = line.split(',');
      if (name_w_at === '') {
        continue;
      }
      const name = name_w_at.split('@')[0].trim();
      const tdp = parseFloat(tdp_r.replace('\r', ''));
      if (!(name in data) || data[name] < tdp) {
        data[name] = tdp;
      }
    }

    return data;
  }
}

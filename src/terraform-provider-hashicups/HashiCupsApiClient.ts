export class HashiCupsApiClient {
  private readonly host: string;
  private readonly token: string;

  constructor(host: string, token: string) {
    this.host = host;
    this.token = token;
  }

  static async signin(config: {
    host: string;
    username: string;
    password: string;
  }) {
    const response = await fetch(new URL("/signin", config.host), {
      method: "POST",
      body: JSON.stringify({
        username: config.username,
        password: config.password,
      }),
    });
    if (!response.ok) {
      throw new Error("Could not sign in with these credentials");
    }

    const json: any = await response.json();
    return new HashiCupsApiClient(config.host, json.token);
  }

  async coffees() {
    const response = await fetch(new URL("/coffees", this.host));
    if (!response.ok) {
      throw new Error("Could not get coffees");
    }

    const json: any = await response.json();
    return json;
  }

  async getOrder(id: number) {
    const response = await fetch(new URL(`/orders/${id}`, this.host), {
      headers: {
        Authorization: this.token,
      },
    });
    if (!response.ok) {
      throw new Error(`Could not get order: ${await response.text()}`);
    }

    const json: any = await response.json();
    return json;
  }

  async createOrder(data: unknown) {
    const response = await fetch(new URL(`/orders`, this.host), {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Authorization: this.token,
      },
    });
    if (!response.ok) {
      throw new Error(`Could not get order: ${await response.text()}`);
    }

    const json: any = await response.json();
    return json;
  }

  async updateOrder(id: number, data: unknown) {
    const response = await fetch(new URL(`/orders/${id}`, this.host), {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Authorization: this.token,
      },
    });
    if (!response.ok) {
      throw new Error(`Could not update order: ${await response.text()}`);
    }

    const json: any = await response.json();
    return json;
  }

  async deleteOrder(id: number) {
    const response = await fetch(new URL(`/orders/${id}`, this.host), {
      method: "DELETE",
      headers: {
        Authorization: this.token,
      },
    });
    if (!response.ok) {
      throw new Error(`Could not delete order: ${await response.text()}`);
    }
  }
}

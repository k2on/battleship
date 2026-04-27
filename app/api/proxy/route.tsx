export async function GET(request: Request) {
        const url = new URL(request.url);
        const target = url.searchParams.get('r');
        if (!target) throw Error("No 'r' param given in the url");

        const upstream = await fetch(target);

        const headers = new Headers(upstream.headers);
        headers.delete('content-encoding');
        headers.delete('content-length');
        headers.delete('transfer-encoding');

        return new Response(upstream.body, {
                status: upstream.status,
                headers,
        });
}

export async function POST(request: Request) {
        const url = new URL(request.url);
        const target = url.searchParams.get('r');
        if (!target) throw Error("No 'r' param given in the url");

        const body = await request.arrayBuffer();

        const upstream = await fetch(target, {
                method: "POST",
                headers: {
                        'Content-Type': request.headers.get('content-type') ?? 'application/json',
                },
                body,
        });

        const headers = new Headers(upstream.headers);
        headers.delete('content-encoding');
        headers.delete('content-length');
        headers.delete('transfer-encoding');

        return new Response(upstream.body, {
                status: upstream.status,
                headers,
        });
}

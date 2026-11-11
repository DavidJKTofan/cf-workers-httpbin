import { html, json } from '../lib/http';
import { echoRequest } from '../lib/inspect';
import type { RouteGroup } from '../types';

const FORM_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>httpbin - HTML form</title>
  <style>
    body { font: 16px/1.5 system-ui, sans-serif; max-width: 34rem; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    label, legend { font-weight: 600; }
    p > label { display: block; }
    input:not([type=radio], [type=checkbox]), textarea { font: inherit; width: 100%; box-sizing: border-box; padding: 0.375rem 0.5rem; }
    fieldset { margin: 1rem 0; padding: 0.5rem 0.75rem; }
    fieldset label { font-weight: 400; margin-right: 1rem; }
    button { font: inherit; padding: 0.5rem 1rem; }
  </style>
</head>
<body>
  <h1>HTML form</h1>
  <p>Submitting posts the fields to <code>/forms/post</code>, which echoes them back as JSON.</p>
  <form method="post" action="/forms/post">
    <p><label for="custname">Customer name</label><input id="custname" name="custname" required></p>
    <p><label for="custtel">Telephone</label><input id="custtel" name="custtel" type="tel"></p>
    <p><label for="custemail">Email</label><input id="custemail" name="custemail" type="email"></p>
    <fieldset>
      <legend>Pizza size</legend>
      <label><input type="radio" name="size" value="small"> Small</label>
      <label><input type="radio" name="size" value="medium"> Medium</label>
      <label><input type="radio" name="size" value="large"> Large</label>
    </fieldset>
    <fieldset>
      <legend>Toppings</legend>
      <label><input type="checkbox" name="topping" value="bacon"> Bacon</label>
      <label><input type="checkbox" name="topping" value="cheese"> Extra cheese</label>
      <label><input type="checkbox" name="topping" value="onion"> Onion</label>
      <label><input type="checkbox" name="topping" value="mushroom"> Mushroom</label>
    </fieldset>
    <p><label for="delivery">Preferred delivery time</label><input id="delivery" name="delivery" type="time" min="11:00" max="21:00" step="900"></p>
    <p><label for="comments">Delivery instructions</label><textarea id="comments" name="comments" rows="3"></textarea></p>
    <button type="submit">Submit order</button>
  </form>
</body>
</html>
`;

export const forms: RouteGroup = {
	id: 'forms',
	title: 'Forms',
	routes: [
		{
			methods: ['GET', 'POST'],
			path: '/forms/post',
			summary: 'An HTML form (GET) that posts back to this endpoint (POST)',
			view: 'page',
			handler: async (c) => (c.request.method === 'POST' ? json(await echoRequest(c)) : html(FORM_PAGE)),
		},
	],
};

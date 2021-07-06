import Neon, { sc, u, wallet } from '@cityofzion/neon-js';
import {
	DEFAULT_GAS_PRECISION,
	DEFAULT_NEO_NETWORK_MAGIC,
	DEFAULT_NEO_RPC_ADDRESS,
	DEFAULT_SC_SCRIPTHASH,
} from '../constants/default';
import { NEOHelper } from '../helpers/neo-helper';
import { Rent } from '../interfaces/rent';

export class RentFuseContract {
	static getRent = async ({ tokenId }: { tokenId: string }) => {
		// The contract object i'll call by using this
		const contract = RentFuseContract.getContract();

		// Invoke the contract to perform a read (NB: Methods are always camel case and bytestrings are passed as integers! :O)
		const result = await contract.testInvoke('getRent', [sc.ContractParam.integer(tokenId)]);
		// Parse rent into a rent object
		return RentFuseContract.parseRent(result.stack[0]);
	};

	static getRentList = async ({ fromIndex }: { fromIndex?: number }) => {
		// The contract object i'll call by using this
		const contract = RentFuseContract.getContract();

		// Invoke the contract to perform a read
		const result = await contract.testInvoke('getRentList', [
			sc.ContractParam.integer(fromIndex !== undefined ? fromIndex : 0),
		]);

		// Parse rent objects from returned stack
		return RentFuseContract.parseRentList(result.stack[0]);
	};

	static getRentListAsOwner = async ({ address, fromIndex }: { address: string; fromIndex?: number }) => {
		// The contract object i'll call by using this
		const contract = RentFuseContract.getContract();

		// Invoke the contract to perform a read
		const result = await contract.testInvoke('getRentListAsOwner', [
			sc.ContractParam.hash160(address),
			sc.ContractParam.integer(fromIndex !== undefined ? fromIndex : 0),
		]);

		// Parse rent objects from returned stack
		return RentFuseContract.parseRentList(result.stack[0]);
	};

	static getRentListAsTenant = async ({ address, fromIndex }: { address: string; fromIndex?: number }) => {
		// The contract object i'll call by using this
		const contract = RentFuseContract.getContract();

		// Invoke the contract to perform a read
		const result = await contract.testInvoke('getRentListAsTenant', [
			sc.ContractParam.hash160(address),
			sc.ContractParam.integer(fromIndex !== undefined ? fromIndex : 0),
		]);

		// Parse rent objects from returned stack
		return RentFuseContract.parseRentList(result.stack[0]);
	};

	// price absolute, it's later added gas precision, duration in ms
	static createToken = async ({
		nftScriptHash,
		nftTokenId,
		price,
		duration,
		walletContext,
	}: {
		nftScriptHash: string;
		nftTokenId: string;
		price: number;
		duration: number;
		walletContext: any;
	}) => {
		// UInt160 NFTScriptHash, ByteString NFTTokenId, BigInteger price, ulong duration
		const response = await walletContext.invokeFunction(DEFAULT_SC_SCRIPTHASH, 'createToken', [
			{ type: 'Address', value: nftScriptHash },
			{ type: 'String', value: nftTokenId },
			{ type: 'Integer', value: Math.ceil(Number(price) * DEFAULT_GAS_PRECISION) },
			{ type: 'Integer', value: duration },
		]);

		console.log(response);

		// If error thrown an exception
		if (response.result.error && response.result.error.message) {
			throw new Error('An error occurred invoking contract function');
		}

		// Get txId from response to know wheter it finished processing it
		const txId = response.result as string;
		// Search the txId notification with my contract has and correct event
		const notification = (await NEOHelper.getNotificationsFromTxId(txId)).find(
			(n: any) => n.contract === DEFAULT_SC_SCRIPTHASH && n.eventname === 'TokenCreated',
		);

		// If notification is found everything is good!
		return notification !== undefined;
	};

	private static getContract = () => {
		return new Neon.experimental.SmartContract(Neon.u.HexString.fromHex(DEFAULT_SC_SCRIPTHASH), {
			networkMagic: DEFAULT_NEO_NETWORK_MAGIC,
			rpcAddress: DEFAULT_NEO_RPC_ADDRESS,
		});
	};

	// Accept a stack item to get a rent object from it
	private static parseRent = (item: { type: any; value?: any }) => {
		if (Array.isArray(item.value) && item.value.length == 13) {
			return {
				tokenId: u.HexString.fromBase64(item.value[0].value).toAscii(),
				owner: wallet.getAddressFromScriptHash(u.reverseHex(u.HexString.fromBase64(item.value[1].value) as any)),
				tenant: item.value[2].value
					? wallet.getAddressFromScriptHash(u.reverseHex(u.HexString.fromBase64(item.value[2].value) as any))
					: null,
				nftScriptHash: wallet.getAddressFromScriptHash(
					u.reverseHex(u.HexString.fromBase64(item.value[3].value) as any),
				),
				nftTokenId:
					item.value[4].type === 'ByteString'
						? u.HexString.fromBase64(item.value[4].value).toAscii()
						: item.value[4].value,
				price: +item.value[5].value,
				balance: +item.value[6].value,
				amount: +item.value[7].value,
				state: +item.value[8].value,
				duration: +item.value[9].value,
				createdOn: +item.value[10].value,
				rentedOn: +item.value[11].value,
				closedOn: +item.value[12].value,
			} as Rent;
		}
		return null;
	};

	private static parseRentList = (item: { type: any; value?: any }) => {
		const rentList = [];

		if (Array.isArray(item.value)) {
			for (const element of item.value) {
				const rent = RentFuseContract.parseRent(element);
				if (rent !== null) {
					rentList.push(rent);
				}
			}
		}

		return rentList;
	};
}
